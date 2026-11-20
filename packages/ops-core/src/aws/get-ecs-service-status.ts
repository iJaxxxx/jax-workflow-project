import {
	DescribeServicesCommand,
	ECSClient,
	ListClustersCommand,
	type Service,
} from "@aws-sdk/client-ecs";
import { awsConfig, callAws, defaults } from "./shared";

const client = new ECSClient(awsConfig);

const RECENT_EVENTS = 5;

// 没配置集群名时，挨个集群找这个服务
async function findService(serviceName: string): Promise<Service | undefined> {
	const clusters = defaults.ecsCluster
		? [defaults.ecsCluster]
		: ((await client.send(new ListClustersCommand({}))).clusterArns ?? []);

	const results = await Promise.all(
		clusters.map((cluster) =>
			client.send(
				new DescribeServicesCommand({ cluster, services: [serviceName] })
			)
		)
	);
	return results
		.flatMap((res) => res.services ?? [])
		.find((service) => service.status !== "INACTIVE");
}

export interface GetEcsServiceStatusInput {
	serviceName: string;
}

// 查询 ECS 服务的健康状况：期望/运行中的任务数、最近的部署和服务事件
export async function getEcsServiceStatus({
	serviceName,
}: GetEcsServiceStatusInput) {
	const service = await callAws("查询 ECS 服务", () =>
		findService(serviceName)
	);
	if (!service) {
		throw new Error(`没有找到 ECS 服务 ${serviceName}`);
	}

	return {
		deployments: (service.deployments ?? []).map((deployment) => ({
			createdAt: deployment.createdAt?.toISOString() ?? null,
			rolloutState: deployment.rolloutState ?? "UNKNOWN",
			runningCount: deployment.runningCount ?? 0,
			status: deployment.status ?? "UNKNOWN",
			taskDefinition: deployment.taskDefinition?.split("/").pop() ?? "",
		})),
		desiredCount: service.desiredCount ?? 0,
		recentEvents: (service.events ?? [])
			.slice(0, RECENT_EVENTS)
			.map((event) => ({
				message: event.message ?? "",
				time: event.createdAt?.toISOString() ?? null,
			})),
		runningCount: service.runningCount ?? 0,
		serviceName,
		status: service.status ?? "UNKNOWN",
	};
}
