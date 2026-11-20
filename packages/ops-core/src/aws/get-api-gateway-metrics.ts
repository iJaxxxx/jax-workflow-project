import {
	CloudWatchClient,
	GetMetricDataCommand,
	type MetricDataQuery,
} from "@aws-sdk/client-cloudwatch";
import { awsConfig, callAws, lookbackWindow } from "./shared";

const client = new CloudWatchClient(awsConfig);

// API Gateway 是请求入口：用户看到的 5xx 在这里都会被统计，不管错在后面哪一层
const PERIOD_SECONDS = 60;

const METRICS = [
	{ id: "requests", name: "Count", stat: "Sum" },
	{ id: "errors5xx", name: "5XXError", stat: "Sum" },
	{ id: "errors4xx", name: "4XXError", stat: "Sum" },
	{ id: "latencyP95", name: "Latency", stat: "p95" },
] as const;

function buildQueries(apiName: string, stage: string): MetricDataQuery[] {
	return METRICS.map((metric) => ({
		Id: metric.id,
		MetricStat: {
			Metric: {
				Dimensions: [
					{ Name: "ApiName", Value: apiName },
					{ Name: "Stage", Value: stage },
				],
				MetricName: metric.name,
				Namespace: "AWS/ApiGateway",
			},
			Period: PERIOD_SECONDS,
			Stat: metric.stat,
		},
	}));
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export interface GetApiGatewayMetricsInput {
	// REST API 名称，例如 jax-gh-rest
	apiName: string;
	minutes: number;
	stage: string;
}

// 查询 API Gateway（REST API）最近一段时间的请求数、5xx、4xx 和 p95 延迟（1 分钟一个点）
export async function getApiGatewayMetrics({
	apiName,
	minutes,
	stage,
}: GetApiGatewayMetricsInput) {
	const { start, end } = lookbackWindow(minutes);
	const res = await callAws("查询 API Gateway 指标", () =>
		client.send(
			new GetMetricDataCommand({
				EndTime: end,
				MetricDataQueries: buildQueries(apiName, stage),
				ScanBy: "TimestampAscending",
				StartTime: start,
			})
		)
	);

	// 各指标的时间点不一定对齐（没数据的分钟会缺），按时间戳合并
	const byTime = new Map<
		string,
		{
			errors4xx: number;
			errors5xx: number;
			latencyP95Ms: number;
			requests: number;
		}
	>();
	const totals = { errors4xx: 0, errors5xx: 0, requests: 0 };
	let maxLatencyP95Ms = 0;

	for (const result of res.MetricDataResults ?? []) {
		const values = result.Values ?? [];
		for (const [index, timestamp] of (result.Timestamps ?? []).entries()) {
			const time = timestamp.toISOString();
			const point = byTime.get(time) ?? {
				errors4xx: 0,
				errors5xx: 0,
				latencyP95Ms: 0,
				requests: 0,
			};
			const value = values[index] ?? 0;
			if (result.Id === "latencyP95") {
				point.latencyP95Ms = Math.round(value);
				maxLatencyP95Ms = Math.max(maxLatencyP95Ms, point.latencyP95Ms);
			} else if (
				result.Id === "requests" ||
				result.Id === "errors5xx" ||
				result.Id === "errors4xx"
			) {
				point[result.Id] = value;
			}
			byTime.set(time, point);
		}
		if (
			result.Id === "requests" ||
			result.Id === "errors5xx" ||
			result.Id === "errors4xx"
		) {
			totals[result.Id] = sum(values);
		}
	}

	// 只保留有请求或有报错的分钟，避免一小时 60 个空点撑大上下文
	const points = [...byTime.entries()]
		.map(([time, point]) => ({ time, ...point }))
		.filter((point) => point.requests > 0 || point.errors5xx > 0)
		.sort((a, b) => a.time.localeCompare(b.time));

	return {
		api: `${apiName}/${stage}`,
		points,
		summary: {
			...totals,
			errorRate5xxPercent:
				totals.requests === 0
					? 0
					: Number(((totals.errors5xx / totals.requests) * 100).toFixed(2)),
			maxLatencyP95Ms,
		},
		windowMinutes: minutes,
	};
}
