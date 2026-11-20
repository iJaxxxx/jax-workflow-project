import { searchDocsResult } from "@jax-workflow-project/ops-core/docs";
import { searchDocs } from "@jax-workflow-project/rag";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// 接 packages/rag（LangChain 做的 RAG）：在项目原始文档里按意思检索。
// 相似度过滤（MIN_SCORE 0.6）和结果整理在 packages/ops-core/src/docs.ts，和 Mastra 版共用
export const searchDocsTool = tool(
	async ({ query }) =>
		JSON.stringify(await searchDocsResult(searchDocs, query)),
	{
		description:
			"在项目原始文档（docs/、knowledge/raw/）里按意思检索，返回最相关的几段原文和出处。wiki 里找不到答案、或用户问项目流程和文档内容时使用。",
		name: "search-docs",
		schema: z.object({
			query: z.string().describe("要检索的问题或关键词，用中文写完整的一句话"),
		}),
	}
);
