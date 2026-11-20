// 排障 workflow 的 LangGraph 版：用代码固定「七项证据全部查到」，模型只负责最后的汇总。
// 对应 apps/agent/src/mastra/workflows/ops-diagnosis.ts：
//   Mastra:    createWorkflow().parallel([7 个 step]).then(report).commit()
//   LangGraph: StateGraph，START 连出 7 条边（并行），7 个节点都连到 reporter（汇合），reporter → END
// 区别：Mastra 的并行步骤输出自动按 step id 合成一个对象交给下一步；
// LangGraph 里各节点只返回「状态更新」，并行写同一个字段要给它配 reducer（这里把各项证据合并成一个对象）。
import {
	collectOne,
	type EvidenceName,
} from "@jax-workflow-project/ops-core/evidence";
import { opsReporterInstructions } from "@jax-workflow-project/ops-core/prompts";
import { buildReportPrompt } from "@jax-workflow-project/ops-core/report-prompt";
import {
	END,
	ReducedValue,
	START,
	StateGraph,
	StateSchema,
} from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "langchain";
import { z } from "zod";
import { createChatModel } from "../model";

const evidenceSchema = z.object({
	data: z.unknown(),
	error: z.string().nullable(),
});

const DiagnosisState = new StateSchema({
	// 七个节点并行写 evidence，各写一项，reducer 负责合并
	evidence: new ReducedValue(
		z.record(z.string(), evidenceSchema).default(() => ({})),
		{
			inputSchema: z.record(z.string(), evidenceSchema),
			reducer: (current, update) => ({ ...current, ...update }),
		}
	),
	minutes: z
		.number()
		.int()
		.min(5)
		.max(1440)
		.default(60)
		.describe("往前看多少分钟"),
	question: z.string().describe("要排查的问题，例如「收藏接口报 5xx」"),
	report: z.string().default(""),
});

type State = typeof DiagnosisState.State;

// 每项证据一个节点，单项失败只记录 error，不中断整个排障。具体查什么见 packages/ops-core/src/evidence.ts
function evidenceNode(name: EvidenceName) {
	return async (state: State) => ({
		evidence: { [name]: await collectOne(name, state.minutes) },
	});
}

// 报告节点（节点名 reporter：LangGraph 不允许节点名和状态字段 report 同名）：不挂工具的 LLM，提示词和 Mastra 的 ops-reporter 一样
async function report(state: State) {
	const response = await createChatModel().invoke([
		new SystemMessage(opsReporterInstructions),
		new HumanMessage(
			buildReportPrompt({
				evidence: state.evidence,
				minutes: state.minutes,
				now: new Date().toISOString(),
				question: state.question,
			})
		),
	]);
	return { report: response.text };
}

// 七个取证节点，沿请求链路从外到内（和 Mastra workflow 的 .parallel([...]) 一一对应）
const evidenceNodes = [
	"alarms",
	"apiMetrics",
	"metrics",
	"logs",
	"ecsLogs",
	"deployment",
	"ecs",
] as const satisfies readonly EvidenceName[];

export const opsDiagnosis = new StateGraph(DiagnosisState)
	.addNode("alarms", evidenceNode("alarms"))
	.addNode("apiMetrics", evidenceNode("apiMetrics"))
	.addNode("metrics", evidenceNode("metrics"))
	.addNode("logs", evidenceNode("logs"))
	.addNode("ecsLogs", evidenceNode("ecsLogs"))
	.addNode("deployment", evidenceNode("deployment"))
	.addNode("ecs", evidenceNode("ecs"))
	.addNode("reporter", report)
	// START 连出七条边：七个节点在同一个超级步里并行执行
	.addEdge(START, "alarms")
	.addEdge(START, "apiMetrics")
	.addEdge(START, "metrics")
	.addEdge(START, "logs")
	.addEdge(START, "ecsLogs")
	.addEdge(START, "deployment")
	.addEdge(START, "ecs")
	// 数组形式的边：等七个节点全部完成后才执行 reporter（只执行一次）
	.addEdge([...evidenceNodes], "reporter")
	.addEdge("reporter", END)
	.compile({ name: "ops-diagnosis" });
