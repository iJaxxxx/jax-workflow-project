import { listAlarms as query } from "@jax-workflow-project/ops-core/aws/list-alarms";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// 查询逻辑在 packages/ops-core（不依赖任何 Agent 框架），这里只定义 Mastra 工具的 id、描述和 schema
export const listAlarms = createTool({
	description:
		"列出 CloudWatch 告警及其当前状态。排障第一步用它确认现在有哪些告警在响。",
	execute: async (input) => await query(input),
	id: "list-alarms",
	inputSchema: z.object({
		onlyFiring: z
			.boolean()
			.default(false)
			.describe("true 只返回正在告警（ALARM 状态）的，false 返回全部"),
	}),
	outputSchema: z.object({
		alarms: z.array(
			z.object({
				metric: z.string(),
				name: z.string(),
				reason: z.string(),
				state: z.string(),
				updatedAt: z.string().nullable(),
			})
		),
	}),
});
