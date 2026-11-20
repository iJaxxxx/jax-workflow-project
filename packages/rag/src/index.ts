import { DEFAULT_TOP_K } from "./config";
import { type ChunkMetadata, loadStore } from "./store";

export interface DocHit {
	content: string;
	heading?: string;
	score: number;
	source: string;
}

// 只做检索、不调大模型：返回最相关的 k 个片段（score 为余弦相似度，越大越相关）
export const searchDocs = async (
	query: string,
	k: number = DEFAULT_TOP_K
): Promise<DocHit[]> => {
	const store = await loadStore();
	const results = await store.similaritySearchWithScore(query, k);
	return results.map(([doc, score]) => {
		const meta = doc.metadata as ChunkMetadata;
		return {
			content: doc.pageContent,
			heading: meta.heading,
			score,
			source: meta.source,
		};
	});
};
