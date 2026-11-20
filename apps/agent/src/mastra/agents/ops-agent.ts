import { opsAgentInstructions } from "@jax-workflow-project/ops-core/prompts";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { localModel } from "../model";
import { collectDiagnosisEvidence } from "../tools/aws/collect-diagnosis-evidence";
import { getApiGatewayMetrics } from "../tools/aws/get-api-gateway-metrics";
import { getEcsServiceStatus } from "../tools/aws/get-ecs-service-status";
import { getLambdaDeployment } from "../tools/aws/get-lambda-deployment";
import { getLambdaMetrics } from "../tools/aws/get-lambda-metrics";
import { listAlarms } from "../tools/aws/list-alarms";
import { searchLogs } from "../tools/aws/search-logs";
import { searchDocs } from "../tools/docs/search-docs";
import { listWikiPages } from "../tools/wiki/list-wiki-pages";
import { proposeWikiUpdate } from "../tools/wiki/propose-wiki-update";
import { readWikiPage } from "../tools/wiki/read-wiki-page";
import { MAX_RETRIES, prepareStep, wikiGuard } from "./wiki-guard";

// 所有工具都是只读的：这个 Agent 只负责查证据、给建议，不会改动线上任何东西。
// 排障分两段：先调 collect-diagnosis-evidence 由代码一次查全七项证据，模型只负责解读；
// 用户追问时再用单项工具深挖（比如换个关键词搜日志）。
// 早先让 8B 模型自己挨个调七个工具，它经常查两三项就停、或者把时间范围填错。
// 查完证据后再查运维 wiki（apps/agent/wiki/）：列页面 → 读 1~2 页 → 必要时提交修改建议。
// wiki 只读，改动只能以「建议」形式写到 wiki/_proposals/，由人审核。
// Mastra 默认 maxSteps 是 5（一次工具调用算一步）。一次排障约 6~7 步：
// 取证 1 + 列页面 1 + 读页面 2 + 提建议 1 + 写回答 1，追问时可能还要连查几项，留够余量。
// 小模型经常跳过 wiki，所以由 ./wiki-guard.ts 在代码里约束每一步可用的工具，并在跳过时打回重试。
const MAX_STEPS = 10;

export const opsAgent = new Agent({
	defaultOptions: { maxSteps: MAX_STEPS, prepareStep },
	id: "ops-agent",
	instructions: opsAgentInstructions,
	maxProcessorRetries: MAX_RETRIES,
	// 记住同一个对话线程里最近的消息，可以接着上一轮的排查结果追问。
	// 不传 storage 时使用 Mastra 实例上的 storage（见 ../storage.ts）。
	// 工具结果（日志、指标）很长，8B 模型上下文有限，只带最近 10 条。
	memory: new Memory({ options: { lastMessages: 10 } }),
	model: localModel,
	name: "AWS 运维助手",
	outputProcessors: [wikiGuard],
	tools: {
		collectDiagnosisEvidence,
		getApiGatewayMetrics,
		getEcsServiceStatus,
		getLambdaDeployment,
		getLambdaMetrics,
		listAlarms,
		listWikiPages,
		proposeWikiUpdate,
		readWikiPage,
		searchDocs,
		searchLogs,
	},
});
