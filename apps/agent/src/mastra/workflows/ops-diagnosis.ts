// 排障 workflow：用代码固定「七项证据全部查到」，模型只负责最后的汇总。
// 证据沿请求链路从外到内：API Gateway 入口 → Lambda → ECS 上的 Go 服务。
// 对比 ops-agent：那边由模型自己决定调哪些工具，小模型经常查两项就下结论。

import {
	collectOne,
	type EvidenceName,
} from "@jax-workflow-project/ops-core/evidence";
import { buildReportPrompt } from "@jax-workflow-project/ops-core/report-prompt";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

const inputSchema = z.object({
	minutes: z
		.number()
		.int()
		.min(5)
		.max(1440)
		.default(60)
		.describe("往前看多少分钟"),
	question: z.string().describe("要排查的问题，例如「收藏接口报 5xx」"),
});

// 每个取证步骤的输出：查到了放 data，没查到放 error。单项失败不会中断整个排障。
const evidenceSchema = z.object({
	data: z.unknown(),
	error: z.string().nullable(),
});

type Input = z.infer<typeof inputSchema>;

// 每项证据一个步骤，Playground 里能看到它们并行执行。具体查什么见 packages/ops-core/src/evidence.ts
// Id 用泛型保留字面量类型：并行步骤的输出以 id 为键，下一步的 inputSchema 要和它对上
function evidenceStep<Id extends EvidenceName>(id: Id) {
	return createStep({
		execute: ({ inputData }) => collectOne(id, inputData.minutes),
		id,
		inputSchema,
		outputSchema: evidenceSchema,
	});
}

const alarms = evidenceStep("alarms");
const apiMetrics = evidenceStep("apiMetrics");
const metrics = evidenceStep("metrics");
const logs = evidenceStep("logs");
const ecsLogs = evidenceStep("ecsLogs");
const deployment = evidenceStep("deployment");
const ecs = evidenceStep("ecs");

const report = createStep({
	execute: async ({ inputData, getInitData, mastra }) => {
		const { question, minutes } = getInitData<Input>();
		const reporter = mastra.getAgent("opsReporter");
		const response = await reporter.generate(
			buildReportPrompt({
				evidence: inputData,
				minutes,
				now: new Date().toISOString(),
				question,
			})
		);
		return { evidence: inputData, report: response.text };
	},
	id: "report",
	inputSchema: z.object({
		alarms: evidenceSchema,
		apiMetrics: evidenceSchema,
		deployment: evidenceSchema,
		ecs: evidenceSchema,
		ecsLogs: evidenceSchema,
		logs: evidenceSchema,
		metrics: evidenceSchema,
	}),
	outputSchema: z.object({
		evidence: z.record(z.string(), evidenceSchema),
		report: z.string(),
	}),
});

export const opsDiagnosis = createWorkflow({
	id: "ops-diagnosis",
	inputSchema,
	outputSchema: report.outputSchema,
})
	.parallel([alarms, apiMetrics, metrics, logs, deployment, ecs, ecsLogs])
	.then(report)
	.commit();
