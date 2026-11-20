import { readWikiPage as read } from "@jax-workflow-project/ops-core/wiki";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// 页面名不对时不抛错，返回相近的页面名让模型重读，逻辑见 packages/ops-core/src/wiki.ts
export const readWikiPage = createTool({
	description:
		"读取一个运维 wiki 页面的全文。name 用 list-wiki-pages 返回的页面名，例如 errors/injected-fault。",
	execute: async ({ name }) => await read(name),
	id: "read-wiki-page",
	inputSchema: z.object({
		name: z.string().describe("页面名，例如 errors/injected-fault"),
	}),
	outputSchema: z.object({
		content: z.string(),
		found: z.boolean(),
		links: z.array(z.string()),
		name: z.string(),
	}),
});
