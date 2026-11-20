import {
	GetAliasCommand,
	GetFunctionConfigurationCommand,
	LambdaClient,
} from "@aws-sdk/client-lambda";
import { awsConfig, callAws } from "./shared";

const client = new LambdaClient(awsConfig);

export interface GetLambdaDeploymentInput {
	// 别名，线上流量走 live
	alias: string;
	functionName: string;
}

// 查询 Lambda 函数的运行状态和最近一次部署：别名指向哪个版本、是否在灰度、最后修改时间
export async function getLambdaDeployment({
	alias,
	functionName,
}: GetLambdaDeploymentInput) {
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
}
