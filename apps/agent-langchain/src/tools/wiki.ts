import {
	listWikiPages,
	proposeWikiUpdate,
	readWikiPage,
} from "@jax-workflow-project/ops-core/wiki";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// 运维 wiki 工具：和 Mastra 版读写同一个 apps/agent/wiki/ 目录，逻辑在 packages/ops-core/src/wiki.ts。
// wiki 只读，改动只能以「建议」形式写到 wiki/_proposals/，由人审核。

export const listWikiPagesTool = tool(
	async () => JSON.stringify(await listWikiPages()),
	{
		description:
			"列出运维 wiki 的所有页面（页面名和一句话摘要）。wiki 记录了系统架构、服务说明、已知报错和历史事故。查完证据后先调它，再挑相关页面读。",
		name: "list-wiki-pages",
		schema: z.object({}),
	}
);

export const readWikiPageTool = tool(
	async ({ name }) => JSON.stringify(await readWikiPage(name)),
	{
		description:
			"读取一个运维 wiki 页面的全文。name 用 list-wiki-pages 返回的页面名，例如 errors/injected-fault。",
		name: "read-wiki-page",
		schema: z.object({
			name: z.string().describe("页面名，例如 errors/injected-fault"),
		}),
	}
);

export const proposeWikiUpdateTool = tool(
	async (input) => JSON.stringify(await proposeWikiUpdate(input)),
	{
		description:
			"提交一条运维 wiki 修改建议（新建或修改页面），交给人审核，不会直接改动 wiki。排障发现了 wiki 里没有的新情况时使用。",
		name: "propose-wiki-update",
		schema: z.object({
			content: z
				.string()
				.describe("建议的页面全文（Markdown），开头用 front matter 写 summary"),
			name: z.string().describe("目标页面名，例如 errors/new-error"),
			reason: z.string().describe("为什么要改：这次排障发现了什么"),
		}),
	}
);

export const wikiTools = [
	listWikiPagesTool,
	proposeWikiUpdateTool,
	readWikiPageTool,
];
