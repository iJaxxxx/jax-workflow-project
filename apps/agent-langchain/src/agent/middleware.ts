import {
	type AIMessage,
	type BaseMessage,
	createMiddleware,
	HumanMessage,
	ToolMessage,
} from "langchain";
import { awsTools } from "../tools/aws";
import { searchDocsTool } from "../tools/docs";
import { listWikiPagesTool, readWikiPageTool } from "../tools/wiki";

// LangChain v1 的 middleware 是 createAgent 的扩展点，作用相当于 Mastra Agent 上的
// prepareStep（每步调模型前改请求）+ processors（检查模型输出、打回重试）+ memory 的 lastMessages（截断历史）。
// 这里三个中间件：
// 1. wikiGuard：让 8B 模型「取证 → 列 wiki → 读 wiki → 写回答」，对应 apps/agent/src/mastra/agents/wiki-guard.ts
// 2. historyWindow：发给模型的历史只带最近若干条，对应 Mastra Memory 的 lastMessages: 10
// 3. toolErrors：工具抛错时转成中文 ToolMessage 交还模型，对应 Mastra 把 tool-error 回传给模型

export const MAX_RETRIES = 2;

const AWS_TOOL_NAMES = new Set<string>(awsTools.map((t) => t.name));
// 还没取证时开放的工具：AWS 工具 + 文档检索（问项目文档的问题不需要查 AWS）
const FIRST_STEP_TOOL_NAMES = new Set<string>([
	...AWS_TOOL_NAMES,
	searchDocsTool.name,
]);

const LIST_HINT = "现在只做一件事：调用 list-wiki-pages。不要写回答。";
// 写明「只读一页」：测试里模型想一次并行读两页时，偶尔想完就停、什么都不输出
const READ_HINT =
	"现在只做一件事：从 list-wiki-pages 的结果里挑和证据最相关的一页，调用一次 read-wiki-page。不要写回答。";

// 本轮对话的消息：最后一条用户消息之后的部分。
// 注意 checkpointer 里的 state.messages 是整个线程的历史，而 Mastra prepareStep 的 steps 只含本次运行，
// 所以要先切出本轮，否则第二轮追问会被当成「已经查过 wiki」而不再约束。
function currentTurn(messages: BaseMessage[]) {
	const lastHuman = messages.findLastIndex((m) => HumanMessage.isInstance(m));
	return lastHuman === -1 ? messages : messages.slice(lastHuman);
}

function calledTools(messages: BaseMessage[]) {
	return new Set(
		messages.flatMap((m) =>
			"tool_calls" in m && Array.isArray(m.tool_calls)
				? ((m as AIMessage).tool_calls?.map((call) => call.name) ?? [])
				: []
		)
	);
}

// 下一步应该调哪个 wiki 工具；不需要干预时返回 undefined。
// 一次都没查 AWS 的轮次（例如闲聊、问文档）不干预；单项工具也算取证
function nextWikiTool(called: Set<string>) {
	if (![...AWS_TOOL_NAMES].some((name) => called.has(name))) {
		return;
	}
	if (!called.has(listWikiPagesTool.name)) {
		return { hint: LIST_HINT, tool: listWikiPagesTool.name };
	}
	if (!called.has(readWikiPageTool.name)) {
		return { hint: READ_HINT, tool: readWikiPageTool.name };
	}
}

function textOf(message: AIMessage) {
	return typeof message.content === "string"
		? message.content
		: message.content
				.map((block) => ("text" in block ? String(block.text) : ""))
				.join("");
}

// 回复不合格的原因；合格返回 undefined
function rejectReason(response: AIMessage, wikiHint: string | undefined) {
	const madeCalls = (response.tool_calls ?? []).length > 0;
	if (wikiHint && !madeCalls) {
		return `还没查 wiki。${wikiHint}`;
	}
	if (!(madeCalls || textOf(response).trim())) {
		return "上一步没有任何输出。请按输出格式写出完整回答。";
	}
}

// wrapModelCall 包住「一次模型调用」，一个钩子同时做了 Mastra 两处的事：
// - 调 handler 之前改请求（过滤 tools、在系统提示末尾加一句）= Mastra 的 prepareStep（activeTools + systemMessages）
// - 调 handler 之后检查回复、不合格就带着反馈再调一次 = Mastra 输出处理器 processOutputStep 里的 abort({ retry: true })
// 区别：Mastra 的重试由框架驱动（maxProcessorRetries），这里是自己在钩子里循环调 handler；
// 被打回的那次回复不会写进 state，线程历史里只留最后合格的一次。
// 没有用 toolChoice: "required"：Ollama 不认它（Mastra 版传了也只是摆设），所以只能靠「只开放一个工具 + 提示 + 打回重试」。
export const wikiGuard = createMiddleware({
	name: "WikiGuard",
	wrapModelCall: (request, handler) => {
		const called = calledTools(currentTurn(request.state.messages));
		const next = called.size > 0 ? nextWikiTool(called) : undefined;

		let prepared = request;
		if (called.size === 0) {
			// 还没取证时先藏起 wiki 工具：模型把取证和列页面放在同一步并行调用时，下一步更容易什么都不输出
			prepared = {
				...request,
				tools: request.tools.filter((t) =>
					FIRST_STEP_TOOL_NAMES.has(String(t.name))
				),
			};
		} else if (next) {
			prepared = {
				...request,
				systemMessage: request.systemMessage.concat(`\n\n${next.hint}`),
				tools: request.tools.filter((t) => t.name === next.tool),
			};
		}

		// 不合格就带着反馈重试，最多 MAX_RETRIES 次（模型调用必须串行，所以用递归而不是循环里 await）
		const attempt = async (
			retries: number,
			extra: BaseMessage[]
		): Promise<AIMessage> => {
			const response = await handler({
				...prepared,
				messages: [...prepared.messages, ...extra],
			});
			const feedback = rejectReason(response, next?.hint);
			if (!feedback || retries >= MAX_RETRIES) {
				return response;
			}
			// 打到 stderr，方便在命令行里看出中间件干预了几次（不影响 stdout 上的回答）
			console.error(
				`[wiki-guard] 打回重试 ${retries + 1}/${MAX_RETRIES}：${feedback}`
			);
			// 把被打回的回复（有内容时）和反馈一起带上，再调一次模型
			const rejected = textOf(response).trim() ? [response] : [];
			return attempt(retries + 1, [
				...extra,
				...rejected,
				new HumanMessage(`【系统提示】${feedback}`),
			]);
		};
		return attempt(0, []);
	},
});

// Mastra Memory 的 lastMessages: 10：只把线程里最近 10 条历史发给模型（工具结果很长，8B 模型上下文有限）。
// 截断只发生在发给模型的请求里，checkpointer 里的完整历史不动。
// 本轮的消息全部保留；历史部分从一条用户消息开始切，保证不会把工具调用和它的 ToolMessage 切开。
const HISTORY_MESSAGES = 10;

function trimHistory(messages: BaseMessage[]) {
	const lastHuman = messages.findLastIndex((m) => HumanMessage.isInstance(m));
	if (lastHuman <= 0) {
		return messages;
	}
	const history = messages.slice(0, lastHuman);
	const turn = messages.slice(lastHuman);
	const recent = history.slice(-HISTORY_MESSAGES);
	const start = recent.findIndex((m) => HumanMessage.isInstance(m));
	if (start !== -1) {
		return [...recent.slice(start), ...turn];
	}
	// 上一轮本身就超过 10 条：只留上一轮的提问和最终回答
	const prevHuman = history.findLastIndex((m) => HumanMessage.isInstance(m));
	const finalAnswer = history.at(-1);
	return [
		...(prevHuman === -1 ? [] : [history[prevHuman] as BaseMessage]),
		...(finalAnswer && !ToolMessage.isInstance(finalAnswer)
			? [finalAnswer]
			: []),
		...turn,
	];
}

export const historyWindow = createMiddleware({
	name: "HistoryWindow",
	wrapModelCall: (request, handler) =>
		handler({ ...request, messages: trimHistory(request.messages) }),
});

// 工具抛错（例如 AWS 凭证过期、日志组不存在）时，转成一条中文 ToolMessage 交还模型，让它如实告诉用户，
// 而不是让整个 Agent 运行抛异常中断。
export const toolErrors = createMiddleware({
	name: "ToolErrors",
	wrapToolCall: async (request, handler) => {
		try {
			return await handler(request);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return new ToolMessage({
				content: `工具报错：${message}`,
				name: request.toolCall.name,
				status: "error",
				tool_call_id: request.toolCall.id ?? "",
			});
		}
	},
});
