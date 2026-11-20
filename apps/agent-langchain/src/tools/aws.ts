import { defaults } from "@jax-workflow-project/ops-core";
import { getApiGatewayMetrics } from "@jax-workflow-project/ops-core/aws/get-api-gateway-metrics";
import { getEcsServiceStatus } from "@jax-workflow-project/ops-core/aws/get-ecs-service-status";
import { getLambdaDeployment } from "@jax-workflow-project/ops-core/aws/get-lambda-deployment";
import { getLambdaMetrics } from "@jax-workflow-project/ops-core/aws/get-lambda-metrics";
import { listAlarms } from "@jax-workflow-project/ops-core/aws/list-alarms";
import { searchLogs } from "@jax-workflow-project/ops-core/aws/search-logs";
import { collectDiagnosisEvidence } from "@jax-workflow-project/ops-core/evidence";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// AWS 只读工具。查询逻辑全部在 packages/ops-core，这里只是 LangChain 的 tool() 外壳：
// 名字、描述、输入 schema 和 Mastra 版（apps/agent/src/mastra/tools/aws）一致。
// 对比 Mastra 的 createTool：
// - createTool 的 id ↔ tool() 的 name；Mastra 另有 outputSchema 校验返回值，LangChain 没有（返回值直接变成 ToolMessage 文本）
// - 返回值统一 JSON.stringify，模型看到的内容和 Mastra 版一样是 JSON
// - 抛出的错误由 ../agent/middleware.ts 的 toolErrors 中间件转成中文 ToolMessage 交还模型

const minutesSchema = z
	.number()
	.int()
	.min(5)
	.max(1440)
	.default(60)
	.describe("往前看多少分钟");

const json = (value: unknown) => JSON.stringify(value);

// 给 Agent 用的「一键取证」：七项证据由代码一次查全，返回取证清单 + 证据 + 下一步提示（wikiNext）
export const collectDiagnosisEvidenceTool = tool(
	async ({ minutes }) => json(await collectDiagnosisEvidence(minutes)),
	{
		description:
			"一次性查全排障需要的七项证据：告警、API Gateway 指标、Lambda 指标、Lambda 日志、ECS 日志、Lambda 部署、ECS 服务状态。用户报告故障、告警或问服务是否健康时，第一步调用它。",
		name: "collect-diagnosis-evidence",
		schema: z.object({
			minutes: minutesSchema.describe("往前看多少分钟。用户没说就用 60"),
		}),
	}
);

export const listAlarmsTool = tool(
	async (input) => json(await listAlarms(input)),
	{
		description:
			"列出 CloudWatch 告警及其当前状态。排障第一步用它确认现在有哪些告警在响。",
		name: "list-alarms",
		schema: z.object({
			onlyFiring: z
				.boolean()
				.default(false)
				.describe("true 只返回正在告警（ALARM 状态）的，false 返回全部"),
		}),
	}
);

export const getApiGatewayMetricsTool = tool(
	async (input) => json(await getApiGatewayMetrics(input)),
	{
		description:
			"查询 API Gateway（REST API）最近一段时间的请求数、5xx、4xx 和 p95 延迟（1 分钟一个点）。这是用户请求的入口，用来确认用户实际看到了多少报错、从哪一分钟开始。",
		name: "get-api-gateway-metrics",
		schema: z.object({
			apiName: z
				.string()
				.default(defaults.apiName)
				.describe("REST API 名称，例如 jax-gh-rest"),
			minutes: minutesSchema,
			stage: z.string().default(defaults.apiStage).describe("Stage 名称"),
		}),
	}
);

export const getLambdaMetricsTool = tool(
	async (input) => json(await getLambdaMetrics(input)),
	{
		description:
			"查询某个 Lambda 函数最近一段时间的调用量、错误数、限流数和 p95 耗时（5 分钟一个点）。用来确认错误率或延迟是否异常、从什么时候开始。",
		name: "get-lambda-metrics",
		schema: z.object({
			functionName: z
				.string()
				.default(defaults.lambdaFunction)
				.describe("Lambda 函数名"),
			minutes: minutesSchema,
		}),
	}
);

export const searchLogsTool = tool(
	async (input) => json(await searchLogs(input)),
	{
		description:
			"在 CloudWatch 日志组里按关键词搜索最近的日志。用来找具体的报错信息和堆栈。",
		name: "search-logs",
		schema: z.object({
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
			minutes: minutesSchema,
		}),
	}
);

export const getLambdaDeploymentTool = tool(
	async (input) => json(await getLambdaDeployment(input)),
	{
		description:
			"查询 Lambda 函数的运行状态和最近一次部署：别名指向哪个版本、是否在灰度、最后修改时间。用来判断故障是否和最近的发布有关。",
		name: "get-lambda-deployment",
		schema: z.object({
			alias: z.string().default("live").describe("别名，线上流量走 live"),
			functionName: z
				.string()
				.default(defaults.lambdaFunction)
				.describe("Lambda 函数名"),
		}),
	}
);

export const getEcsServiceStatusTool = tool(
	async (input) => json(await getEcsServiceStatus(input)),
	{
		description:
			"查询 ECS 服务的健康状况：期望/运行中的任务数、最近的部署和服务事件。Lambda 报超时或连接失败时，用它确认后端服务是否正常。",
		name: "get-ecs-service-status",
		schema: z.object({
			serviceName: z
				.string()
				.default(defaults.ecsService)
				.describe("ECS 服务名"),
		}),
	}
);

// 查线上数据的工具（不含 wiki 工具），wiki-guard 中间件用这些名字判断「是否已经取证」
export const awsTools = [
	collectDiagnosisEvidenceTool,
	getApiGatewayMetricsTool,
	getEcsServiceStatusTool,
	getLambdaDeploymentTool,
	getLambdaMetricsTool,
	listAlarmsTool,
	searchLogsTool,
];
