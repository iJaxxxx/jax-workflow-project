// 评测场景：每个场景是一份固定的「证据快照」加标准答案。
// 证据快照不连线上 AWS，每次评测输入完全一样，换模型、改提示词后的分数才能对比。
// injected-fault 来自 2026-11-20 /debug/fail 演练的真实取证结果，其他场景在它的结构上改写。
import type {
	Evidence,
	EvidenceName,
} from "@jax-workflow-project/ops-core/evidence";
import injectedFault from "./fixtures/injected-fault.json" with {
	type: "json",
};

type EvidenceSet = Record<EvidenceName, Evidence>;

export interface Expectation {
	// 每组至少命中一个关键词，算这一组答对
	mustIncludeAny: string[][];
	// 报告里不应该出现的内容（编造、张冠李戴）
	mustNotInclude: string[];
}

export interface Scenario {
	evidence: EvidenceSet;
	expect: Expectation;
	id: string;
	question: string;
	// 这个场景考的是什么
	tests: string;
}

const base = injectedFault as EvidenceSet;
const ok = (data: unknown): Evidence => ({ data, error: null });

const emptyLogs = (logGroup: string, keyword: string) => ({
	count: 0,
	events: [],
	keyword,
	logGroup,
});

const alarmsWith = (lambdaState: string, apiState: string) =>
	ok({
		alarms: [
			{
				metric: "AWS/Lambda/Errors",
				name: "go-caller-sam-live-errors",
				reason: "",
				state: lambdaState,
				updatedAt: "2026-11-20T10:05:00.000Z",
			},
			{
				metric: "AWS/ApiGateway/5XXError",
				name: "jax-gh-rest-5xx",
				reason: "",
				state: apiState,
				updatedAt: "2026-11-20T10:05:00.000Z",
			},
		],
	});

const apiMetrics = (requests: number, errors5xx: number, latencyMs: number) =>
	ok({
		api: "jax-gh-rest/prod",
		points:
			requests === 0
				? []
				: [
						{
							errors4xx: 0,
							errors5xx,
							latencyP95Ms: latencyMs,
							requests,
							time: "2026-11-20T10:05:00.000Z",
						},
					],
		summary: {
			errorRate5xxPercent:
				requests === 0 ? 0 : Math.round((errors5xx / requests) * 100),
			errors4xx: 0,
			errors5xx,
			maxLatencyP95Ms: latencyMs,
			requests,
		},
		windowMinutes: 60,
	});

const lambdaMetrics = (invocations: number, errors: number, p95: number) =>
	ok({
		functionName: "go-caller-sam",
		points: [
			{
				durationP95Ms: p95,
				errors,
				invocations,
				time: "2026-11-20T10:05:00.000Z",
			},
		],
		summary: {
			errorRatePercent:
				invocations === 0 ? 0 : Math.round((errors / invocations) * 100),
			errors,
			invocations,
			maxDurationP95Ms: p95,
			throttles: 0,
		},
		windowMinutes: 60,
	});

const lambdaLog = (message: string) => ({
	message: `2026-11-20T10:05:12.000Z\tabc123\tERROR\t${message}`,
	time: "2026-11-20T10:05:12.000Z",
});

const credentialError = (action: string): Evidence => ({
	data: null,
	error: `${action}失败：AWS 凭证无效或已过期，请先在终端执行 aws login。原始错误：The security token included in the request is expired`,
});

export const scenarios: Scenario[] = [
	{
		evidence: base,
		expect: {
			mustIncludeAny: [
				["/debug/fail"],
				["injected fault", "故障注入", "模拟", "演练"],
				["ECS", "Go 服务", "go-github-users"],
			],
			mustNotInclude: ["凭证", "ENOTFOUND"],
		},
		id: "injected-fault",
		question: "jax-gh-rest-5xx 告警响了，帮我定位原因",
		tests: "后端返回 500：要穿过 Lambda（errors=0）定位到 ECS 的 /debug/fail",
	},
	{
		evidence: {
			...base,
			alarms: alarmsWith("OK", "OK"),
			apiMetrics: apiMetrics(120, 0, 180),
			ecsLogs: ok(emptyLogs("/ecs/go-github-users", "ERROR")),
			logs: ok({
				errors: emptyLogs("/aws/lambda/go-caller-sam", "ERROR"),
				upstream5xx: emptyLogs("/aws/lambda/go-caller-sam", "warn"),
			}),
			metrics: lambdaMetrics(120, 0, 150),
		},
		expect: {
			mustIncludeAny: [["正常", "健康", "未发现", "没有发现", "无异常"]],
			mustNotInclude: ["injected fault", "/debug/fail", "ENOTFOUND", "超时"],
		},
		id: "healthy",
		question: "检查一下线上服务最近一小时是否健康",
		tests: "没有故障：不能硬找问题",
	},
	{
		evidence: {
			...base,
			alarms: alarmsWith("ALARM", "ALARM"),
			apiMetrics: apiMetrics(12, 12, 1900),
			ecsLogs: ok(emptyLogs("/ecs/go-github-users", "ERROR")),
			logs: ok({
				errors: {
					count: 3,
					events: [
						lambdaLog(
							'{"level":"error","msg":"forward failed","path":"/users/list","target":"go-github-users.jax.local:8080","ips":[],"dnsError":"ENOTFOUND","attempts":[{"n":1,"error":"fetch failed","code":"ENOTFOUND"},{"n":2,"error":"fetch failed","code":"ENOTFOUND"}]}'
						),
						lambdaLog(
							'Invoke Error {"errorType":"TypeError","errorMessage":"fetch failed","cause":"Error: getaddrinfo ENOTFOUND go-github-users.jax.local"}'
						),
					],
					keyword: "ERROR",
					logGroup: "/aws/lambda/go-caller-sam",
				},
				upstream5xx: emptyLogs("/aws/lambda/go-caller-sam", "warn"),
			}),
			metrics: lambdaMetrics(12, 12, 1800),
		},
		expect: {
			mustIncludeAny: [
				["ENOTFOUND", "解析", "DNS"],
				["Lambda", "go-caller"],
				["Cloud Map", "jax.local", "命名空间"],
			],
			mustNotInclude: ["injected fault", "/debug/fail"],
		},
		id: "dns-enotfound",
		question: "收藏接口全部报 502，帮我查原因",
		tests: "请求没到 ECS：Lambda 解析不到 Cloud Map 域名，ECS 日志干净",
	},
	{
		evidence: {
			...base,
			alarms: alarmsWith("ALARM", "ALARM"),
			apiMetrics: apiMetrics(6, 6, 29_500),
			ecsLogs: ok(emptyLogs("/ecs/go-github-users", "ERROR")),
			logs: ok({
				errors: {
					count: 2,
					events: [
						lambdaLog(
							"Task timed out after 30.00 seconds (RequestId: abc123, path /users/list)"
						),
					],
					keyword: "ERROR",
					logGroup: "/aws/lambda/go-caller-sam",
				},
				upstream5xx: emptyLogs("/aws/lambda/go-caller-sam", "warn"),
			}),
			metrics: lambdaMetrics(6, 6, 30_000),
		},
		expect: {
			mustIncludeAny: [
				["超时", "timed out", "timeout"],
				["Lambda", "go-caller"],
				["30"],
			],
			mustNotInclude: ["injected fault", "/debug/fail", "ENOTFOUND"],
		},
		id: "lambda-timeout",
		question: "jax-gh-rest-5xx 告警响了，接口很慢，帮我看看",
		tests: "Lambda 30 秒超时：要从耗时和 Task timed out 日志判断",
	},
	{
		evidence: {
			alarms: credentialError("查询告警"),
			apiMetrics: credentialError("查询 API Gateway 指标"),
			deployment: credentialError("查询 Lambda 部署"),
			ecs: credentialError("查询 ECS 服务"),
			ecsLogs: credentialError("搜索日志"),
			logs: credentialError("搜索日志"),
			metrics: credentialError("查询 Lambda 指标"),
		},
		expect: {
			mustIncludeAny: [["aws login"], ["凭证"]],
			mustNotInclude: ["/debug/fail", "injected fault", "100%", "ENOTFOUND"],
		},
		id: "credentials-expired",
		question: "jax-gh-rest-5xx 告警响了，帮我定位原因",
		tests: "取证全部失败：要如实说凭证过期，不能编造数据",
	},
];

// 证据快照的「当前时间」，和 injected-fault 的数据时间对齐
export const SNAPSHOT_NOW = "2026-11-20T10:10:00.000Z";
