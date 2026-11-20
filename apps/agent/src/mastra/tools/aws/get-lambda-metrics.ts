import { defaults } from "@jax-workflow-project/ops-core";
import { getLambdaMetrics as query } from "@jax-workflow-project/ops-core/aws/get-lambda-metrics";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// 查询逻辑在 packages/ops-core（不依赖任何 Agent 框架），这里只定义 Mastra 工具的 id、描述和 schema
export const getLambdaMetrics = createTool({
	description:
		"查询某个 Lambda 函数最近一段时间的调用量、错误数、限流数和 p95 耗时（5 分钟一个点）。用来确认错误率或延迟是否异常、从什么时候开始。",
	execute: async (input) => await query(input),
	id: "get-lambda-metrics",
	inputSchema: z.object({
		functionName: z
			.string()
			.default(defaults.lambdaFunction)
			.describe("Lambda 函数名"),
		minutes: z
			.number()
			.int()
			.min(5)
			.max(1440)
			.default(60)
			.describe("往前看多少分钟"),
	}),
	outputSchema: z.object({
		functionName: z.string(),
		points: z.array(
			z.object({
				durationP95Ms: z.number(),
				errors: z.number(),
				invocations: z.number(),
				time: z.string(),
			})
		),
		summary: z.object({
			errorRatePercent: z.number(),
			errors: z.number(),
			invocations: z.number(),
			maxDurationP95Ms: z.number(),
			throttles: z.number(),
		}),
		windowMinutes: z.number(),
	}),
});
