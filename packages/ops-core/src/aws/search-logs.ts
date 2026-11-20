import {
	CloudWatchLogsClient,
	FilterLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { awsConfig, callAws, lookbackWindow } from "./shared";

const client = new CloudWatchLogsClient(awsConfig);

// 日志原文可能很长，截断后再给模型，避免撑爆上下文
const MAX_MESSAGE_LENGTH = 400;

export interface SearchLogsInput {
	// 要匹配的关键词；空字符串返回全部
	keyword: string;
	limit: number;
	logGroup: string;
	minutes: number;
}

// 在 CloudWatch 日志组里按关键词搜索最近的日志
export async function searchLogs({
	keyword,
	limit,
	logGroup,
	minutes,
}: SearchLogsInput) {
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
}
