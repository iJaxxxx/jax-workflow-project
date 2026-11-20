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

// 「取证过程」的展示顺序：沿请求链路从外到内
const displayOrder: EvidenceName[] = [
	"alarms",
	"apiMetrics",
	"metrics",
	"logs",
	"ecsLogs",
	"deployment",
	"ecs",
];

// 每项证据调了哪个工具、传了什么参数、查的是什么，给人看的说明
const evidenceSources: Record<
	EvidenceName,
	(minutes: number) => { calls: string; label: string; source: string }
> = {
	alarms: () => ({
		calls: "`list-alarms`（onlyFiring=false）",
		label: "告警",
		source: "CloudWatch 告警列表（全部状态）",
	}),
	apiMetrics: (minutes) => ({
		calls: `\`get-api-gateway-metrics\`（apiName=${defaults.apiName}, stage=${defaults.apiStage}, minutes=${minutes}）`,
		label: "入口指标",
		source: "请求数、5xx、4xx、p95 延迟",
	}),
	deployment: () => ({
		calls: `\`get-lambda-deployment\`（functionName=${defaults.lambdaFunction}, alias=live）`,
		label: "Lambda 部署",
		source: "live 别名指向的版本和灰度配置",
	}),
	ecs: () => ({
		calls: `\`get-ecs-service-status\`（serviceName=${defaults.ecsService}）`,
		label: "ECS 服务",
		source: "任务数、部署和最近事件",
	}),
	ecsLogs: (minutes) => ({
		calls: `\`search-logs\`（logGroup=${defaults.ecsLogGroup}, keyword=ERROR, minutes=${minutes}）`,
		label: "Go 服务日志",
		source: "Go 服务的报错原文和接口路径",
	}),
	logs: (minutes) => ({
		calls: `\`search-logs\` × 2（logGroup=${defaults.logGroup}, keyword=ERROR / warn, minutes=${minutes}）`,
		label: "Lambda 日志",
		source: "转发失败（ERROR）和后端返回 5xx（warn）",
	}),
	metrics: (minutes) => ({
		calls: `\`get-lambda-metrics\`（functionName=${defaults.lambdaFunction}, minutes=${minutes}）`,
		label: "Lambda 指标",
		source: "调用数、错误数、限流、p95 耗时",
	}),
};

// 由代码生成的取证清单：一行一项，放在工具返回结果的最前面，Playground 的工具卡片里一眼能看到
export function describeQueries(
	minutes: number,
	evidence: Record<EvidenceName, Evidence>
): string[] {
	const lines = displayOrder.map((name, index) => {
		const { calls, label, source } = evidenceSources[name](minutes);
		const { error } = evidence[name];
		const result = error ? `失败：${error}` : source;
		// 显示在 JSON 里，Markdown 的反引号不会被渲染，去掉
		const plainCalls = calls.replaceAll("`", "");
		return `${index + 1}. ${error ? "❌" : "✅"} ${label}：${plainCalls} → ${result}`;
	});
	return [`内部并行调用了以下工具（minutes=${minutes}）：`, ...lines];
}
