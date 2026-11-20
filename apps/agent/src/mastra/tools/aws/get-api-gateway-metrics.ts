import { defaults } from "@jax-workflow-project/ops-core";
import { getApiGatewayMetrics as query } from "@jax-workflow-project/ops-core/aws/get-api-gateway-metrics";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// 查询逻辑在 packages/ops-core（不依赖任何 Agent 框架），这里只定义 Mastra 工具的 id、描述和 schema
export const getApiGatewayMetrics = createTool({
	description:
		"查询 API Gateway（REST API）最近一段时间的请求数、5xx、4xx 和 p95 延迟（1 分钟一个点）。这是用户请求的入口，用来确认用户实际看到了多少报错、从哪一分钟开始。",
	execute: async (input) => await query(input),
	id: "get-api-gateway-metrics",
	inputSchema: z.object({
		apiName: z
			.string()
			.default(defaults.apiName)
			.describe("REST API 名称，例如 jax-gh-rest"),
		minutes: z
			.number()
			.int()
			.min(5)
			.max(1440)
			.default(60)
			.describe("往前看多少分钟"),
		stage: z.string().default(defaults.apiStage).describe("Stage 名称"),
	}),
	outputSchema: z.object({
		api: z.string(),
		points: z.array(
			z.object({
				errors4xx: z.number(),
				errors5xx: z.number(),
				latencyP95Ms: z.number(),
				requests: z.number(),
				time: z.string(),
			})
		),
		summary: z.object({
			errorRate5xxPercent: z.number(),
			errors4xx: z.number(),
			errors5xx: z.number(),
			maxLatencyP95Ms: z.number(),
			requests: z.number(),
		}),
		windowMinutes: z.number(),
	}),
});
