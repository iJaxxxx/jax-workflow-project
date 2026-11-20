import { listWikiPages as list } from "@jax-workflow-project/ops-core/wiki";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// wiki 读写逻辑在 packages/ops-core/src/wiki.ts，和 LangChain 版共用同一个 apps/agent/wiki/ 目录
export const listWikiPages = createTool({
	description:
		"列出运维 wiki 的所有页面（页面名和一句话摘要）。wiki 记录了系统架构、服务说明、已知报错和历史事故。查完证据后先调它，再挑相关页面读。",
	execute: async () => await list(),
	id: "list-wiki-pages",
	inputSchema: z.object({}),
	outputSchema: z.object({
		nextStep: z.string(),
		pages: z.array(z.object({ name: z.string(), summary: z.string() })),
	}),
});
