import { collectDiagnosisEvidence as collect } from "@jax-workflow-project/ops-core/evidence";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// 给 Agent 用的「一键取证」：七项证据由代码一次查全。
// 小模型自己挨个调工具时经常查两三项就停、或者把时间范围填错，固定流程交给代码更稳。
// 取证逻辑和返回值（checklist / evidence / wikiNext）在 packages/ops-core/src/evidence.ts，LangChain 版共用
export const collectDiagnosisEvidence = createTool({
	description:
		"一次性查全排障需要的七项证据：告警、API Gateway 指标、Lambda 指标、Lambda 日志、ECS 日志、Lambda 部署、ECS 服务状态。用户报告故障、告警或问服务是否健康时，第一步调用它。",
	execute: async ({ minutes }) => await collect(minutes),
	id: "collect-diagnosis-evidence",
	inputSchema: z.object({
		minutes: z
			.number()
			.int()
			.min(5)
			.max(1440)
			.default(60)
			.describe("往前看多少分钟。用户没说就用 60"),
	}),
});
