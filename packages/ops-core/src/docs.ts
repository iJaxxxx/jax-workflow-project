// search-docs 工具的结果整理。检索本身由 packages/rag（LangChain 做的 RAG）完成，
// 这里只做框架无关的部分：按相似度过滤、拼出处、给模型的提示语，Mastra 和 LangChain 两边的工具共用。
// 和运维 wiki 的分工：wiki 是整理好的结论，先查 wiki；wiki 没有，再来原始文档里搜。

// 低于这个相似度的片段基本不相关（实测相关片段 0.7~0.8，不相关的 0.55 左右），直接丢掉，免得模型硬引用
export const MIN_SCORE = 0.6;

// 每次取回的片段数
export const DOC_TOP_K = 4;

// 和 packages/rag 的 DocHit 结构一致（这里不 import rag，保持本包不依赖 LangChain）
interface DocHitLike {
	content: string;
	heading?: string;
	score: number;
	source: string;
}

export async function searchDocsResult(
	search: (query: string, k: number) => Promise<DocHitLike[]>,
	query: string
) {
	try {
		const hits = await search(query, DOC_TOP_K);
		const relevant = hits.filter((hit) => hit.score >= MIN_SCORE);
		return {
			hits: relevant.map((hit) => ({
				content: hit.content,
				score: Number(hit.score.toFixed(3)),
				source: hit.heading ? `${hit.source} — ${hit.heading}` : hit.source,
			})),
			message:
				relevant.length > 0
					? `找到 ${relevant.length} 段相关原文，回答时注明出处。`
					: "文档里没有找到相关内容。如实告诉用户，不要编造。",
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { hits: [], message: `文档检索失败：${message}` };
	}
}
