import { defaults } from "@jax-workflow-project/ops-core";
import { getEcsServiceStatus as query } from "@jax-workflow-project/ops-core/aws/get-ecs-service-status";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// 查询逻辑在 packages/ops-core（不依赖任何 Agent 框架），这里只定义 Mastra 工具的 id、描述和 schema
export const getEcsServiceStatus = createTool({
	description:
		"查询 ECS 服务的健康状况：期望/运行中的任务数、最近的部署和服务事件。Lambda 报超时或连接失败时，用它确认后端服务是否正常。",
	execute: async (input) => await query(input),
	id: "get-ecs-service-status",
	inputSchema: z.object({
		serviceName: z.string().default(defaults.ecsService).describe("ECS 服务名"),
	}),
	outputSchema: z.object({
		deployments: z.array(
			z.object({
				createdAt: z.string().nullable(),
				rolloutState: z.string(),
				runningCount: z.number(),
				status: z.string(),
				taskDefinition: z.string(),
			})
		),
		desiredCount: z.number(),
		recentEvents: z.array(
			z.object({ message: z.string(), time: z.string().nullable() })
		),
		runningCount: z.number(),
		serviceName: z.string(),
		status: z.string(),
	}),
});
