import { isAIMessage, isToolMessage } from "@langchain/core/messages";
import { GraphRecursionError } from "@langchain/langgraph";
import type { BaseMessage } from "langchain";
import type { createOpsAgent } from "../agent/ops-agent";
import { MAX_STEPS, RECURSION_LIMIT } from "../agent/ops-agent";

// ops / chat 两个命令行共用：跑一轮 Agent，边跑边打印每次工具调用（名字 + 参数）和结果摘要，最后打印回答。
// 用 streamMode: "updates"：每个图节点（model_request / tools）执行完推送一次它新增的消息。
// 没用逐 token 的 "messages" 模式，是因为 wikiGuard 中间件会在一次模型调用里打回重试，
// 逐 token 打印会把被打回的回复也印出来；"updates" 只推送最终写进 state 的那一条。

type OpsAgent = ReturnType<typeof createOpsAgent>;

const SUMMARY_LENGTH = 160;

function shorten(text: string) {
	const oneLine = text.replace(/\s+/g, " ").trim();
	return oneLine.length > SUMMARY_LENGTH
		? `${oneLine.slice(0, SUMMARY_LENGTH)}…`
		: oneLine;
}

function parse(content: string): Record<string, unknown> | undefined {
	try {
		const value: unknown = JSON.parse(content);
		return value && typeof value === "object"
			? (value as Record<string, unknown>)
			: undefined;
	} catch {
		// 不是 JSON（例如工具报错的提示文字），直接截断显示
	}
}

// 工具结果的一句话摘要（完整结果模型能看到，人只需要知道查到了什么）
export function summarizeToolResult(name: string, content: string) {
	const data = parse(content);
	if (!data) {
		return shorten(content);
	}
	if (name === "collect-diagnosis-evidence" && Array.isArray(data.checklist)) {
		return `\n    ${(data.checklist as string[]).join("\n    ")}`;
	}
	if (name === "list-wiki-pages" && Array.isArray(data.pages)) {
		const pages = data.pages as Array<{ name: string }>;
		return `${pages.length} 页：${pages.map((page) => page.name).join("、")}`;
	}
	if (name === "read-wiki-page") {
		return data.found
			? `已读 ${String(data.name)}（${String(data.content).length} 字）`
			: `没有这一页：${shorten(String(data.content))}`;
	}
	if (name === "search-docs" && Array.isArray(data.hits)) {
		const hits = data.hits as Array<{ score: number; source: string }>;
		const sources = hits.map((hit) => `${hit.source}（${hit.score}）`);
		return `${String(data.message)} ${sources.join("；")}`;
	}
	if (name === "search-logs") {
		return `${String(data.logGroup)} 关键词「${String(data.keyword)}」命中 ${String(data.count)} 条`;
	}
	return shorten(content);
}

function textOf(message: BaseMessage) {
	return typeof message.content === "string"
		? message.content
		: message.content
				.map((block) => ("text" in block ? String(block.text) : ""))
				.join("");
}

function printMessage(message: BaseMessage) {
	if (isAIMessage(message)) {
		for (const call of message.tool_calls ?? []) {
			console.log(`\n[调用工具] ${call.name} ${JSON.stringify(call.args)}`);
		}
		const text = textOf(message).trim();
		if (text && (message.tool_calls ?? []).length === 0) {
			console.log(`\n${text}`);
		}
	} else if (isToolMessage(message)) {
		const name = message.name ?? "";
		const label = message.status === "error" ? "[工具报错]" : "[工具结果]";
		console.log(
			`${label} ${name}：${summarizeToolResult(name, textOf(message))}`
		);
	}
}

async function streamTurn(
	agent: OpsAgent,
	question: string,
	threadId?: string
) {
	const stream = await agent.stream(
		{ messages: [{ content: question, role: "user" }] },
		{
			configurable: threadId ? { thread_id: threadId } : undefined,
			recursionLimit: RECURSION_LIMIT,
			streamMode: "updates",
		}
	);
	for await (const update of stream) {
		for (const nodeUpdate of Object.values(update)) {
			const messages = (nodeUpdate as { messages?: BaseMessage[] } | null)
				?.messages;
			for (const message of messages ?? []) {
				printMessage(message);
			}
		}
	}
}

// threadId 为空时不带记忆（ops 一次性提问）；chat 传同一个 threadId，多轮共享上下文。
// 出错（步数超限、Ollama 没启动等）只打印一句话，不抛异常：chat 里可以接着问下一句
export async function runAgentTurn(
	agent: OpsAgent,
	question: string,
	threadId?: string
) {
	try {
		await streamTurn(agent, question, threadId);
		return true;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const hint =
			error instanceof GraphRecursionError
				? `超过步数上限（${MAX_STEPS} 次模型调用），这一轮没有写完回答。`
				: `运行出错：${message}`;
		console.error(`\n[出错] ${hint}`);
		return false;
	}
}
