import {
	GetAliasCommand,
	GetFunctionConfigurationCommand,
	LambdaClient,
} from "@aws-sdk/client-lambda";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { awsConfig, callAws, defaults } from "./shared";

const client = new LambdaClient(awsConfig);

export const getLambdaDeployment = createTool({
	description:
		"查询 Lambda 函数的运行状态和最近一次部署：别名指向哪个版本、是否在灰度、最后修改时间。用来判断故障是否和最近的发布有关。",
	execute: async ({ functionName, alias }) => {
		const [config, aliasInfo] = await callAws("查询 Lambda 部署", () =>
			Promise.all([
				client.send(
					new GetFunctionConfigurationCommand({
						FunctionName: functionName,
						Qualifier: alias,
					})
				),
				client.send(
					new GetAliasCommand({ FunctionName: functionName, Name: alias })
				),
			])
		);

		// 灰度发布时，别名会把一部分流量分给新版本
		const canaryWeights = aliasInfo.RoutingConfig?.AdditionalVersionWeights;

		return {
			alias,
			canary: Object.entries(canaryWeights ?? {}).map(([version, weight]) => ({
				trafficPercent: Math.round(weight * 100),
				version,
			})),
			functionName,
			lastModified: config.LastModified ?? null,
			lastUpdateStatus: config.LastUpdateStatus ?? "UNKNOWN",
			memoryMb: config.MemorySize ?? null,
			runtime: config.Runtime ?? null,
			state: config.State ?? "UNKNOWN",
			timeoutSeconds: config.Timeout ?? null,
			version: aliasInfo.FunctionVersion ?? null,
		};
	},
	id: "get-lambda-deployment",
	inputSchema: z.object({
		alias: z.string().default("live").describe("别名，线上流量走 live"),
		functionName: z
			.string()
			.default(defaults.lambdaFunction)
			.describe("Lambda 函数名"),
	}),
	outputSchema: z.object({
		alias: z.string(),
		canary: z.array(
			z.object({ trafficPercent: z.number(), version: z.string() })
		),
		functionName: z.string(),
		lastModified: z.string().nullable(),
		lastUpdateStatus: z.string(),
		memoryMb: z.number().nullable(),
		runtime: z.string().nullable(),
		state: z.string(),
		timeoutSeconds: z.number().nullable(),
		version: z.string().nullable(),
	}),
});
