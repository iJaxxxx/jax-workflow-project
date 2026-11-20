import { defaults } from "@jax-workflow-project/ops-core";
import { getLambdaDeployment as query } from "@jax-workflow-project/ops-core/aws/get-lambda-deployment";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// 查询逻辑在 packages/ops-core（不依赖任何 Agent 框架），这里只定义 Mastra 工具的 id、描述和 schema
export const getLambdaDeployment = createTool({
	description:
		"查询 Lambda 函数的运行状态和最近一次部署：别名指向哪个版本、是否在灰度、最后修改时间。用来判断故障是否和最近的发布有关。",
	execute: async (input) => await query(input),
	id: "get-lambda-deployment",
	inputSchema: z.object({
		alias: z.string().default("live").describe("别名，线上流量走 live"),
		functionName: z
			.string()
			.default(defaults.lambdaFunction)
			.describe("Lambda 函数名"),
	}),
	outputSchema: z.object({
		alias: z.string(),
		canary: z.array(
			z.object({ trafficPercent: z.number(), version: z.string() })
		),
		functionName: z.string(),
		lastModified: z.string().nullable(),
		lastUpdateStatus: z.string(),
		memoryMb: z.number().nullable(),
		runtime: z.string().nullable(),
		state: z.string(),
		timeoutSeconds: z.number().nullable(),
		version: z.string().nullable(),
	}),
});
