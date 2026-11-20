import type {
	ProcessInputStepArgs,
	ProcessOutputStepArgs,
	Processor,
} from "@mastra/core/processors";

// 让 8B 模型「查完线上证据 → 列 wiki 页面 → 读一页 → 再写回答」的代码兜底。
// 只写在 prompt 和工具结果里时，模型拿到证据后经常直接写回答、跳过 wiki，还会编造参考页面名。
// 两道保险：
// 1. prepareStep：每一步只开放该用的工具，并在系统提示末尾补一句「现在只做一件事」。
//    Ollama 不认 toolChoice: "required"，所以只能算提醒，模型仍可能不调工具。
// 2. wikiGuard 输出处理器：该调 wiki 工具却没调、或者什么都没输出时，打回去重试这一步（最多 MAX_RETRIES 次）。

// 查线上数据的工具（不含 wiki 工具）
const AWS_TOOLS = [
	"collectDiagnosisEvidence",
	"getApiGatewayMetrics",
	"getEcsServiceStatus",
	"getLambdaDeployment",
	"getLambdaMetrics",
	"listAlarms",
	"searchLogs",
];

// 还没取证时开放的工具：AWS 工具 + 文档检索（问项目文档的问题不需要查 AWS）
const FIRST_STEP_TOOLS = [...AWS_TOOLS, "searchDocs"];

export const MAX_RETRIES = 2;

const LIST_HINT = "现在只做一件事：调用 list-wiki-pages。不要写回答。";
// 写明「只读一页」：测试里模型想一次并行读两页时，偶尔想完就停、什么都不输出
const READ_HINT =
	"现在只做一件事：从 list-wiki-pages 的结果里挑和证据最相关的一页，调用一次 read-wiki-page。不要写回答。";

interface StepLike {
	toolCalls?: Array<{ payload?: { toolName?: string }; toolName?: string }>;
}

function calledTools(steps: unknown[]) {
	return new Set(
		(steps as StepLike[]).flatMap((step) =>
			(step.toolCalls ?? []).map(
				(call) => call.payload?.toolName ?? call.toolName ?? ""
			)
		)
	);
}

// 下一步应该调哪个 wiki 工具；不需要干预时返回 undefined。
// 一次都没查 AWS 的轮次（例如闲聊）不干预；单项工具也算取证（测试里模型偶尔跳过一键取证、只调 list-alarms）。
function nextWikiTool(called: Set<string>) {
	if (!AWS_TOOLS.some((tool) => called.has(tool))) {
		return;
	}
	if (!called.has("listWikiPages")) {
		return { hint: LIST_HINT, tool: "listWikiPages" };
	}
	if (!called.has("readWikiPage")) {
		return { hint: READ_HINT, tool: "readWikiPage" };
	}
}

export function prepareStep({ steps, systemMessages }: ProcessInputStepArgs) {
	const called = calledTools(steps);
	// 还没取证时先藏起 wiki 工具：测试里模型把取证和列页面放在同一步并行调用时，下一步更容易什么都不输出
	if (called.size === 0) {
		return { activeTools: FIRST_STEP_TOOLS };
	}
	const next = nextWikiTool(called);
	if (!next) {
		return;
	}
	return {
		activeTools: [next.tool],
		systemMessages: [
			...systemMessages,
			{ content: next.hint, role: "system" as const },
		],
		toolChoice: "required" as const,
	};
}

export const wikiGuard = {
	id: "wiki-guard",
	processOutputStep({
		abort,
		messageList,
		retryCount,
		steps,
		text,
		toolCalls,
	}: ProcessOutputStepArgs) {
		if (retryCount >= MAX_RETRIES) {
			return messageList;
		}
		const madeCalls = (toolCalls ?? []).length > 0;
		// 实测 steps 只含之前已完成的步骤（不含当前这一步）。即使含当前步也没关系：只在当前步没调工具时才干预
		const next = nextWikiTool(calledTools(steps));
		if (next && !madeCalls) {
			abort(`还没查 wiki。${next.hint}`, { retry: true });
		}
		if (!(madeCalls || text?.trim())) {
			abort("上一步没有任何输出。请按输出格式写出完整回答。", {
				retry: true,
			});
		}
		return messageList;
	},
} satisfies Processor<"wiki-guard">;
