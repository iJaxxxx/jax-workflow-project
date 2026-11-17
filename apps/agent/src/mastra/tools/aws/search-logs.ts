import {
	CloudWatchLogsClient,
	FilterLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { awsConfig, callAws, defaults, lookbackWindow } from "./shared";

const client = new CloudWatchLogsClient(awsConfig);

// 日志原文可能很长，截断后再给模型，避免撑爆上下文
const MAX_MESSAGE_LENGTH = 400;

export const searchLogs = createTool({
	description:
		"在 CloudWatch 日志组里按关键词搜索最近的日志。用来找具体的报错信息和堆栈。",
	execute: async ({ logGroup, keyword, minutes, limit }) => {
		const { start, end } = lookbackWindow(minutes);
		const res = await callAws("搜索日志", () =>
			client.send(
				new FilterLogEventsCommand({
					endTime: end.getTime(),
					// 关键词加引号按字面匹配；留空则不过滤
					filterPattern: keyword ? `"${keyword}"` : undefined,
					limit,
					logGroupName: logGroup,
					startTime: start.getTime(),
				})
			)
		);

		const events = (res.events ?? []).map((event) => ({
			message: (event.message ?? "").trim().slice(0, MAX_MESSAGE_LENGTH),
			time: new Date(event.timestamp ?? 0).toISOString(),
		}));

		return { count: events.length, events, keyword, logGroup };
	},
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
