import { opsReporterInstructions } from "@jax-workflow-project/ops-core/prompts";
import { Agent } from "@mastra/core/agent";
import { localModel } from "../model";

// 排障 workflow 的最后一步用它：证据已经由代码查好，它只负责读证据、写报告，所以不挂任何工具。
export const opsReporter = new Agent({
	id: "ops-reporter",
	instructions: opsReporterInstructions,
	model: localModel,
	name: "AWS 排障报告员",
});
