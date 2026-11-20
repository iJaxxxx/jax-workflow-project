import {
	CloudWatchClient,
	DescribeAlarmsCommand,
} from "@aws-sdk/client-cloudwatch";
import { awsConfig, callAws } from "./shared";

const client = new CloudWatchClient(awsConfig);

export interface ListAlarmsInput {
	// true 只返回正在告警（ALARM 状态）的，false 返回全部
	onlyFiring: boolean;
}

// 列出 CloudWatch 告警及其当前状态
export async function listAlarms({ onlyFiring }: ListAlarmsInput) {
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
}
