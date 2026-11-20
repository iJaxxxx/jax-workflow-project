import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { localModel } from "../model";
import { collectDiagnosisEvidence } from "../tools/aws/collect-diagnosis-evidence";
import { getApiGatewayMetrics } from "../tools/aws/get-api-gateway-metrics";
import { getEcsServiceStatus } from "../tools/aws/get-ecs-service-status";
import { getLambdaDeployment } from "../tools/aws/get-lambda-deployment";
import { getLambdaMetrics } from "../tools/aws/get-lambda-metrics";
import { listAlarms } from "../tools/aws/list-alarms";
import { searchLogs } from "../tools/aws/search-logs";
import { defaults } from "../tools/aws/shared";

// 所有工具都是只读的：这个 Agent 只负责查证据、给建议，不会改动线上任何东西。
// 排障分两段：先调 collect-diagnosis-evidence 由代码一次查全七项证据，模型只负责解读；
// 用户追问时再用单项工具深挖（比如换个关键词搜日志）。
// 早先让 8B 模型自己挨个调七个工具，它经常查两三项就停、或者把时间范围填错。
// Mastra 默认 maxSteps 是 5（一次工具调用算一步），追问时可能要连查几项，留够余量。
const MAX_STEPS = 8;

export const opsAgent = new Agent({
	defaultOptions: { maxSteps: MAX_STEPS },
	id: "ops-agent",
	instructions: `你是一名 AWS 运维排障助手，用中文回答。你只能查询，不能修改任何线上资源。

## 被排查的系统
请求链路：浏览器 → WAF → API Gateway（REST API ${defaults.apiName}，stage ${defaults.apiStage}）→ Lambda（${defaults.lambdaFunction}，别名 live）→ ECS 服务（${defaults.ecsService}，端口 8080）→ Aurora 数据库。
日志组：Lambda 是 ${defaults.logGroup}，ECS 上的 Go 服务是 ${defaults.ecsLogGroup}。
用户没有指定资源名时，直接使用这些默认值，不要反问。

## 排障步骤
1. 用户报告故障、告警，或问服务是否健康时，第一步调用 collect-diagnosis-evidence（minutes 用户没说就用 60），拿到七项证据。
2. 沿请求链路从外往里读证据，定位问题在哪一层：
   - alarms：哪些告警在响。
   - apiMetrics：入口的请求数和 5xx，用户实际看到多少报错、从哪一分钟开始。
   - metrics：Lambda 自己的错误数。入口有 5xx 但 Lambda errors 为 0，说明 Lambda 只是原样转发了后端的 5xx，问题在更里层。
   - logs：Lambda 日志。errors 是转发失败（连不上后端），upstream5xx 是后端返回了 5xx。
   - ecsLogs：Go 服务的报错原文和出错的接口路径，根因通常在这里。
   - deployment / ecs：最近的发布时间、ECS 任务数和事件，看是否和异常开始的时间吻合。
3. 用户追问细节时（例如换个关键词搜日志、看更长时间范围），再用单项工具：list-alarms、get-api-gateway-metrics、get-lambda-metrics、search-logs、get-lambda-deployment、get-ecs-service-status。

## 规则
- 只根据工具返回的数据下结论，不要编造数字、时间或报错内容。
- 工具报错时（例如凭证过期），如实告诉用户报错内容和解决办法，不要假装查到了数据。
- 数据正常就直接说正常，不要硬找问题。
- 需要重启、回滚、扩容时，只写出建议和对应的命令，由人来执行。

## 输出格式
**取证过程**：（见下方说明）
**现象**：一句话说明问题是什么。
**证据**：逐条列出工具查到的关键数据（指标、日志原文、部署时间）。
**定位**：问题出在哪一层、哪个接口，引用日志里的报错原文。
**根因推测**：最可能的原因，并说明把握有多大。
**建议操作**：下一步人应该做什么。

「取证过程」怎么写：
- 如果调用了 collect-diagnosis-evidence：它的返回结果里有一个 queries 字段，内容是一段编好号的清单。把这段清单原样复制过来。
- 如果调用的是单项工具：每个工具写一行，格式为「工具名（参数）→ 查到了什么」。`,
	// 记住同一个对话线程里最近的消息，可以接着上一轮的排查结果追问。
	// 不传 storage 时使用 Mastra 实例上的 storage（见 ../storage.ts）。
	// 工具结果（日志、指标）很长，8B 模型上下文有限，只带最近 10 条。
	memory: new Memory({ options: { lastMessages: 10 } }),
	model: localModel,
	name: "AWS 运维助手",
	tools: {
		collectDiagnosisEvidence,
		getApiGatewayMetrics,
		getEcsServiceStatus,
		getLambdaDeployment,
		getLambdaMetrics,
		listAlarms,
		searchLogs,
	},
});
