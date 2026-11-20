// 排障要查的七项证据，沿请求链路从外到内：告警 → API Gateway 入口 → Lambda → ECS 上的 Go 服务。
// 两边的 Agent 共用这里：
// - Mastra：ops-diagnosis workflow（每项一个并行步骤）和 collect-diagnosis-evidence 工具
// - LangChain：ops-diagnosis StateGraph（每项一个并行节点）和 collect_diagnosis_evidence 工具
import { getApiGatewayMetrics } from "./aws/get-api-gateway-metrics";
import { getEcsServiceStatus } from "./aws/get-ecs-service-status";
import { getLambdaDeployment } from "./aws/get-lambda-deployment";
import { getLambdaMetrics } from "./aws/get-lambda-metrics";
import { listAlarms } from "./aws/list-alarms";
import { searchLogs } from "./aws/search-logs";
import { defaults } from "./aws/shared";

type Collector = (minutes: number) => Promise<unknown>;

export const evidenceCollectors = {
	alarms: async () => await listAlarms({ onlyFiring: false }),

	apiMetrics: async (minutes) =>
		await getApiGatewayMetrics({
			apiName: defaults.apiName,
			minutes,
			stage: defaults.apiStage,
		}),

	deployment: async () =>
		await getLambdaDeployment({
			alias: "live",
			functionName: defaults.lambdaFunction,
		}),

	ecs: async () =>
		await getEcsServiceStatus({ serviceName: defaults.ecsService }),

	// Go 服务自己的报错（slog JSON 日志里是 "level":"ERROR"），这里才看得到真正的错误原因
	ecsLogs: async (minutes) =>
		await searchLogs({
			keyword: "ERROR",
			limit: 20,
			logGroup: defaults.ecsLogGroup,
			minutes,
		}),

	// go-caller 的日志：转发失败（Lambda 抛错）带 ERROR；后端返回 5xx 时它记一条 "level":"warn"
	logs: async (minutes) => {
		const search = (keyword: string) =>
			searchLogs({ keyword, limit: 10, logGroup: defaults.logGroup, minutes });
		const [errors, upstream5xx] = await Promise.all([
			search("ERROR"),
			search("warn"),
		]);
		return { errors, upstream5xx };
	},

	metrics: async (minutes) =>
		await getLambdaMetrics({ functionName: defaults.lambdaFunction, minutes }),
} satisfies Record<string, Collector>;

export type EvidenceName = keyof typeof evidenceCollectors;

export interface Evidence {
	data: unknown;
	error: string | null;
}

// 七项证据的名字，顺序和 Object.keys(evidenceCollectors) 一致
export const evidenceNames = Object.keys(evidenceCollectors) as EvidenceName[];

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
	const results = await Promise.all(
		evidenceNames.map((name) => collectOne(name, minutes))
	);
	return Object.fromEntries(
		evidenceNames.map((name, index) => [name, results[index]])
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

// 由代码生成的取证清单：一行一项，放在工具返回结果的最前面，调试界面的工具卡片里一眼能看到
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

// 「一键取证」工具的完整返回值。Mastra 和 LangChain 的 collect-diagnosis-evidence 工具都直接返回它
export async function collectDiagnosisEvidence(minutes: number) {
	const evidence = await collectAll(minutes);
	return {
		// 给人看的取证清单：调了哪些工具、参数、成功与否。
		// 键名按字母序排在最前（Biome 要求对象键排序），工具卡片展开后第一眼就是它
		checklist: describeQueries(minutes, evidence),
		evidence,
		minutes,
		now: new Date().toISOString(),
		// 8B 模型读完一大段证据就想直接写结论，跳过查 wiki。把下一步写进工具结果末尾（键名排序后在最后），比只写在 prompt 里管用
		wikiNext:
			"证据已查完。下一步调用 list-wiki-pages，再用 read-wiki-page 读最相关的 1~2 页，然后才能写回答。",
	};
}
