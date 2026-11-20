import { proposeWikiUpdate as propose } from "@jax-workflow-project/ops-core/wiki";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// 只写修改建议，不改正式页面：建议落在 wiki/_proposals/，由人审核后再合并（见 wiki/README.md）
export const proposeWikiUpdate = createTool({
	description:
		"提交一条运维 wiki 修改建议（新建或修改页面），交给人审核，不会直接改动 wiki。排障发现了 wiki 里没有的新情况时使用。",
	execute: async (input) => await propose(input),
	id: "propose-wiki-update",
	inputSchema: z.object({
		content: z
			.string()
			.describe("建议的页面全文（Markdown），开头用 front matter 写 summary"),
		name: z.string().describe("目标页面名，例如 errors/new-error"),
		reason: z.string().describe("为什么要改：这次排障发现了什么"),
	}),
	outputSchema: z.object({ message: z.string(), ok: z.boolean() }),
});
