import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Document } from "@langchain/core/documents";
import { OllamaEmbeddings } from "@langchain/ollama";
import { EMBED_MODEL, getIndexFile, OLLAMA_BASE_URL } from "./config";

export interface ChunkMetadata {
	heading?: string;
	source: string;
}

interface StoredVector {
	content: string;
	embedding: number[];
	metadata: ChunkMetadata;
}

interface IndexFile {
	createdAt: string;
	embedModel: string;
	vectors: StoredVector[];
}

export class IndexMissingError extends Error {
	constructor(file: string) {
		super(
			`找不到 RAG 索引：${file}\n请先运行 \`pnpm --filter @jax-workflow-project/rag ingest\` 建立索引。`
		);
		this.name = "IndexMissingError";
	}
}

export const createEmbeddings = (): OllamaEmbeddings =>
	new OllamaEmbeddings({ baseUrl: OLLAMA_BASE_URL, model: EMBED_MODEL });

// MemoryVectorStore 只在内存里，这里把向量序列化成 JSON 落盘（纯 JS，不需要原生编译）
export const saveStore = async (store: MemoryVectorStore): Promise<string> => {
	const file = getIndexFile();
	await mkdir(path.dirname(file), { recursive: true });
	const data: IndexFile = {
		createdAt: new Date().toISOString(),
		embedModel: EMBED_MODEL,
		vectors: store.memoryVectors.map((v) => ({
			content: v.content,
			embedding: v.embedding,
			metadata: v.metadata as ChunkMetadata,
		})),
	};
	await writeFile(file, JSON.stringify(data));
	return file;
};

let cached:
	| { file: string; mtimeMs: number; store: MemoryVectorStore }
	| undefined;

// 从 JSON 恢复向量库：直接 addVectors，不会重新调用 embedding
export const loadStore = async (): Promise<MemoryVectorStore> => {
	const file = getIndexFile();
	if (!existsSync(file)) {
		throw new IndexMissingError(file);
	}
	// 按修改时间判断缓存是否过期：重新 ingest 后，常驻进程（如 Mastra）会自动读新索引
	const { mtimeMs } = await stat(file);
	if (cached?.file === file && cached.mtimeMs === mtimeMs) {
		return cached.store;
	}
	const data = JSON.parse(await readFile(file, "utf8")) as IndexFile;
	const store = new MemoryVectorStore(createEmbeddings());
	await store.addVectors(
		data.vectors.map((v) => v.embedding),
		data.vectors.map(
			(v) => new Document({ metadata: v.metadata, pageContent: v.content })
		)
	);
	cached = { file, mtimeMs, store };
	return store;
};
