import {
	CloudWatchClient,
	GetMetricDataCommand,
	type MetricDataQuery,
} from "@aws-sdk/client-cloudwatch";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { awsConfig, callAws, defaults, lookbackWindow } from "./shared";

const client = new CloudWatchClient(awsConfig);

const PERIOD_SECONDS = 300;

const METRICS = [
	{ id: "invocations", name: "Invocations", stat: "Sum" },
	{ id: "errors", name: "Errors", stat: "Sum" },
	{ id: "throttles", name: "Throttles", stat: "Sum" },
	{ id: "durationP95", name: "Duration", stat: "p95" },
] as const;

function buildQueries(functionName: string): MetricDataQuery[] {
	return METRICS.map((metric) => ({
		Id: metric.id,
		MetricStat: {
			Metric: {
				Dimensions: [{ Name: "FunctionName", Value: functionName }],
				MetricName: metric.name,
				Namespace: "AWS/Lambda",
			},
			Period: PERIOD_SECONDS,
			Stat: metric.stat,
		},
	}));
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export const getLambdaMetrics = createTool({
	description:
		"查询某个 Lambda 函数最近一段时间的调用量、错误数、限流数和 p95 耗时（5 分钟一个点）。用来确认错误率或延迟是否异常、从什么时候开始。",
	execute: async ({ functionName, minutes }) => {
		const { start, end } = lookbackWindow(minutes);
		const res = await callAws("查询 Lambda 指标", () =>
			client.send(
				new GetMetricDataCommand({
					EndTime: end,
					MetricDataQueries: buildQueries(functionName),
					ScanBy: "TimestampAscending",
					StartTime: start,
				})
			)
		);

		const series = new Map(
			(res.MetricDataResults ?? []).map((result) => [result.Id, result])
		);
		const values = (id: string) => series.get(id)?.Values ?? [];
		const invocations = sum(values("invocations"));
		const errors = sum(values("errors"));

		// 按时间点对齐成一行一个点，方便模型看出异常从哪一刻开始
		const points = (series.get("invocations")?.Timestamps ?? []).map(
			(timestamp, index) => ({
				durationP95Ms: Math.round(values("durationP95")[index] ?? 0),
				errors: values("errors")[index] ?? 0,
				invocations: values("invocations")[index] ?? 0,
				time: timestamp.toISOString(),
			})
		);

		return {
			functionName,
			points,
			summary: {
				errorRatePercent:
					invocations === 0
						? 0
						: Number(((errors / invocations) * 100).toFixed(2)),
				errors,
				invocations,
				maxDurationP95Ms: Math.round(Math.max(0, ...values("durationP95"))),
				throttles: sum(values("throttles")),
			},
			windowMinutes: minutes,
		};
	},
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
