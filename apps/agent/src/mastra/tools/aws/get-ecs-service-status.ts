import {
	DescribeServicesCommand,
	ECSClient,
	ListClustersCommand,
	type Service,
} from "@aws-sdk/client-ecs";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
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

export const getEcsServiceStatus = createTool({
	description:
		"查询 ECS 服务的健康状况：期望/运行中的任务数、最近的部署和服务事件。Lambda 报超时或连接失败时，用它确认后端服务是否正常。",
	execute: async ({ serviceName }) => {
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
	},
	id: "get-ecs-service-status",
	inputSchema: z.object({
		serviceName: z.string().default(defaults.ecsService).describe("ECS 服务名"),
	}),
	outputSchema: z.object({
		deployments: z.array(
			z.object({
				createdAt: z.string().nullable(),
				rolloutState: z.string(),
				runningCount: z.number(),
				status: z.string(),
				taskDefinition: z.string(),
			})
		),
		desiredCount: z.number(),
		recentEvents: z.array(
			z.object({ message: z.string(), time: z.string().nullable() })
		),
		runningCount: z.number(),
		serviceName: z.string(),
		status: z.string(),
	}),
});
