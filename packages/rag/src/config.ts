import { existsSync } from "node:fs";
import path from "node:path";

// 和 apps/agent/src/mastra/model.ts 保持同一套环境变量：OLLAMA_URL / OLLAMA_MODEL。
// agent 那边的 OLLAMA_URL 带 /v1（OpenAI 兼容接口），LangChain 的 Ollama 客户端走原生接口，这里把 /v1 去掉。
const rawOllamaUrl = process.env.OLLAMA_URL ?? "http://localhost:11434";
export const OLLAMA_BASE_URL = rawOllamaUrl.replace(/\/v1\/?$/, "");
export const CHAT_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:8b";
export const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";

// 默认取回的片段数
export const DEFAULT_TOP_K = 4;

// 从 start 向上找含 pnpm-workspace.yaml 的目录，找不到返回 undefined
const walkUpToWorkspace = (start: string): string | undefined => {
	const dir = path.resolve(start);
	if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
		return dir;
	}
	const parent = path.dirname(dir);
	return parent === dir ? undefined : walkUpToWorkspace(parent);
};

// 定位仓库根：先从 cwd 向上找（Mastra dev server 的 cwd 是 apps/agent/src/mastra/public），
// 找不到（例如在 /tmp 下运行）再从本文件所在目录向上找
export const findRepoRoot = (): string => {
	const root =
		walkUpToWorkspace(process.cwd()) ?? walkUpToWorkspace(import.meta.dirname);
	if (!root) {
		throw new Error(
			"向上找不到 pnpm-workspace.yaml，无法定位仓库根目录；可设置 RAG_INDEX_DIR 指定索引目录"
		);
	}
	return root;
};

// 索引目录：优先 RAG_INDEX_DIR，否则 <仓库根>/packages/rag/.index
export const getIndexDir = (): string =>
	process.env.RAG_INDEX_DIR
		? path.resolve(process.env.RAG_INDEX_DIR)
		: path.join(findRepoRoot(), "packages", "rag", ".index");

export const getIndexFile = (): string =>
	path.join(getIndexDir(), "vectors.json");

// 被索引的原始文档目录（相对仓库根）
export const SOURCE_DIRS = ["docs", "knowledge/raw"] as const;
