import {
	CloudWatchClient,
	DescribeAlarmsCommand,
} from "@aws-sdk/client-cloudwatch";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { awsConfig, callAws } from "./shared";

const client = new CloudWatchClient(awsConfig);

export const listAlarms = createTool({
	description:
		"列出 CloudWatch 告警及其当前状态。排障第一步用它确认现在有哪些告警在响。",
	execute: async ({ onlyFiring }) => {
		const res = await callAws("查询告警", () =>
			client.send(
				new DescribeAlarmsCommand({
					MaxRecords: 50,
					StateValue: onlyFiring ? "ALARM" : undefined,
				})
			)
		);

		return {
			alarms: (res.MetricAlarms ?? []).map((alarm) => ({
				metric: `${alarm.Namespace ?? ""}/${alarm.MetricName ?? ""}`,
				name: alarm.AlarmName ?? "",
				reason: alarm.StateReason ?? "",
				state: alarm.StateValue ?? "UNKNOWN",
				updatedAt: alarm.StateUpdatedTimestamp?.toISOString() ?? null,
			})),
		};
	},
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
