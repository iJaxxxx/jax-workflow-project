// 排障 workflow：用代码固定「五项证据全部查到」，模型只负责最后的汇总。
// 对比 ops-agent：那边由模型自己决定调哪些工具，小模型经常查两项就下结论。
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { getEcsServiceStatus } from "../tools/aws/get-ecs-service-status";
import { getLambdaDeployment } from "../tools/aws/get-lambda-deployment";
import { getLambdaMetrics } from "../tools/aws/get-lambda-metrics";
import { listAlarms } from "../tools/aws/list-alarms";
import { searchLogs } from "../tools/aws/search-logs";
import { defaults } from "../tools/aws/shared";

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

// Id 用泛型保留字面量类型：并行步骤的输出以 id 为键，下一步的 inputSchema 要和它对上
function evidenceStep<Id extends string>(
	id: Id,
	collect: (input: Input) => unknown
) {
	return createStep({
		execute: async ({ inputData }) => {
			try {
				return { data: await collect(inputData), error: null };
			} catch (error) {
				return {
					data: null,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
		id,
		inputSchema,
		outputSchema: evidenceSchema,
	});
}

const alarms = evidenceStep("alarms", () =>
	listAlarms.execute?.({ onlyFiring: false }, {})
);

const metrics = evidenceStep("metrics", ({ minutes }) =>
	getLambdaMetrics.execute?.(
		{ functionName: defaults.lambdaFunction, minutes },
		{}
	)
);

const logs = evidenceStep("logs", ({ minutes }) =>
	searchLogs.execute?.(
		{ keyword: "ERROR", limit: 20, logGroup: defaults.logGroup, minutes },
		{}
	)
);

const deployment = evidenceStep("deployment", () =>
	getLambdaDeployment.execute?.(
		{ alias: "live", functionName: defaults.lambdaFunction },
		{}
	)
);

const ecs = evidenceStep("ecs", () =>
	getEcsServiceStatus.execute?.({ serviceName: defaults.ecsService }, {})
);

const report = createStep({
	execute: async ({ inputData, getInitData, mastra }) => {
		const { question, minutes } = getInitData<Input>();
		const reporter = mastra.getAgent("opsReporter");
		const response = await reporter.generate(
			`用户的问题：${question}
查询范围：最近 ${minutes} 分钟，当前时间 ${new Date().toISOString()}

证据：
${JSON.stringify(inputData, null, 1)}`
		);
		return { evidence: inputData, report: response.text };
	},
	id: "report",
	inputSchema: z.object({
		alarms: evidenceSchema,
		deployment: evidenceSchema,
		ecs: evidenceSchema,
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
	.parallel([alarms, metrics, logs, deployment, ecs])
	.then(report)
	.commit();
