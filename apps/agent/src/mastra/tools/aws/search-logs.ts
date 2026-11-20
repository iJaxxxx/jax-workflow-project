import { defaults } from "@jax-workflow-project/ops-core";
import { searchLogs as query } from "@jax-workflow-project/ops-core/aws/search-logs";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// 查询逻辑在 packages/ops-core（不依赖任何 Agent 框架），这里只定义 Mastra 工具的 id、描述和 schema
export const searchLogs = createTool({
	description:
		"在 CloudWatch 日志组里按关键词搜索最近的日志。用来找具体的报错信息和堆栈。",
	execute: async (input) => await query(input),
	id: "search-logs",
	inputSchema: z.object({
		keyword: z
			.string()
			.default("ERROR")
			.describe(
				"要匹配的关键词，例如 ERROR、timeout、panic；传空字符串返回全部"
			),
		limit: z.number().int().min(1).max(50).default(20),
		logGroup: z
			.string()
			.default(defaults.logGroup)
			.describe("日志组名，例如 /aws/lambda/go-caller-sam"),
		minutes: z
			.number()
			.int()
			.min(5)
			.max(1440)
			.default(60)
			.describe("往前看多少分钟"),
	}),
	outputSchema: z.object({
		count: z.number(),
		events: z.array(z.object({ message: z.string(), time: z.string() })),
		keyword: z.string(),
		logGroup: z.string(),
	}),
});
