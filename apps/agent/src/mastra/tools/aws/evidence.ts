// 排障要查的七项证据，沿请求链路从外到内：告警 → API Gateway 入口 → Lambda → ECS 上的 Go 服务。
// ops-diagnosis workflow（每项一个并行步骤）和 collect-diagnosis-evidence 工具（给 Agent 一次查全）共用这里。
import { getApiGatewayMetrics } from "./get-api-gateway-metrics";
import { getEcsServiceStatus } from "./get-ecs-service-status";
import { getLambdaDeployment } from "./get-lambda-deployment";
import { getLambdaMetrics } from "./get-lambda-metrics";
import { listAlarms } from "./list-alarms";
import { searchLogs } from "./search-logs";
import { defaults } from "./shared";

type Collector = (minutes: number) => Promise<unknown>;

// 工具的 execute 第二个参数是运行上下文，直接调用时不需要
const noContext = {};

export const evidenceCollectors = {
	alarms: async () =>
		await listAlarms.execute?.({ onlyFiring: false }, noContext),

	apiMetrics: async (minutes) =>
		await getApiGatewayMetrics.execute?.(
			{ apiName: defaults.apiName, minutes, stage: defaults.apiStage },
			noContext
		),

	deployment: async () =>
		await getLambdaDeployment.execute?.(
			{ alias: "live", functionName: defaults.lambdaFunction },
			noContext
		),

	ecs: async () =>
		await getEcsServiceStatus.execute?.(
			{ serviceName: defaults.ecsService },
			noContext
		),

	// Go 服务自己的报错（slog JSON 日志里是 "level":"ERROR"），这里才看得到真正的错误原因
	ecsLogs: async (minutes) =>
		await searchLogs.execute?.(
			{ keyword: "ERROR", limit: 20, logGroup: defaults.ecsLogGroup, minutes },
			noContext
		),

	// go-caller 的日志：转发失败（Lambda 抛错）带 ERROR；后端返回 5xx 时它记一条 "level":"warn"
	logs: async (minutes) => {
		const search = (keyword: string) =>
			searchLogs.execute?.(
				{ keyword, limit: 10, logGroup: defaults.logGroup, minutes },
				noContext
			);
		const [errors, upstream5xx] = await Promise.all([
			search("ERROR"),
			search("warn"),
		]);
		return { errors, upstream5xx };
	},

	metrics: async (minutes) =>
		await getLambdaMetrics.execute?.(
			{ functionName: defaults.lambdaFunction, minutes },
			noContext
		),
} satisfies Record<string, Collector>;

export type EvidenceName = keyof typeof evidenceCollectors;

export interface Evidence {
	data: unknown;
	error: string | null;
}

// 单项失败只记录错误，不影响其他证据
export async function collectOne(
	name: EvidenceName,
	minutes: number
): Promise<Evidence> {
	try {
		return { data: await evidenceCollectors[name](minutes), error: null };
	} catch (error) {
		return {
			data: null,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

export async function collectAll(minutes: number) {
	const names = Object.keys(evidenceCollectors) as EvidenceName[];
	const results = await Promise.all(
		names.map((name) => collectOne(name, minutes))
	);
	return Object.fromEntries(
		names.map((name, index) => [name, results[index]])
	) as Record<EvidenceName, Evidence>;
}
