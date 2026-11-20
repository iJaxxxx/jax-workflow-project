# @jax-workflow-project/rag

用 **LangChain.js + 本地 Ollama** 对仓库里的原始 Markdown 文档做检索增强生成（RAG）。

- 文档来源：仓库根的 `docs/**/*.md` 和 `knowledge/raw/**/*.md`
- 切分：先按 Markdown 标题分节（记录标题路径用于引用），再用 `MarkdownTextSplitter` 细分
- 向量：`OllamaEmbeddings`（`nomic-embed-text`），存进 `MemoryVectorStore`，序列化到 `packages/rag/.index/vectors.json`（纯 JS，无需原生编译；已加入 `.gitignore`）
- 回答：LCEL 链 检索 → `ChatPromptTemplate` → `ChatOllama`（`qwen3:8b`）→ `StringOutputParser`，中文作答并列出引用

## 前置条件

```bash
ollama serve                 # 本地 Ollama，默认 http://localhost:11434
ollama pull nomic-embed-text # 向量模型
ollama pull qwen3:8b         # 对话模型
```

## 命令

```bash
# 建立 / 更新索引（文档改动后重跑）
pnpm --filter @jax-workflow-project/rag ingest

# 提问
pnpm --filter @jax-workflow-project/rag ask "jax-workflow 的开发流程是怎样的"
```

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `OLLAMA_URL` | `http://localhost:11434` | 与 `apps/agent` 共用；带 `/v1` 也可以，会自动去掉 |
| `OLLAMA_MODEL` | `qwen3:8b` | 对话模型 |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | 向量模型（换了要重跑 ingest） |
| `RAG_INDEX_DIR` | `<仓库根>/packages/rag/.index` | 索引目录；不设置时从当前目录向上找 `pnpm-workspace.yaml` 定位仓库根 |

## 在代码里复用

```ts
import { searchDocs } from "@jax-workflow-project/rag";

// 只检索、不调大模型；score 是余弦相似度，越大越相关
const hits = await searchDocs("Codex 评审怎么跑", 4);
// [{ content, source: "docs/workflow.md", heading: "…", score }]
```

索引不存在时会抛出 `IndexMissingError`（从 `@jax-workflow-project/rag/store` 导入），提示先运行 ingest。重新 ingest 后，常驻进程会按文件修改时间自动重新加载索引。

## 和 Mastra LLM Wiki 的区别

| | RAG（本包） | LLM Wiki（`apps/agent/wiki/`） |
|---|---|---|
| 内容 | 原始文档、笔记、草稿，不做整理 | 整理过、互相链接的知识页面 |
| 维护方式 | 丢进 `docs/` 或 `knowledge/raw/` 后重跑 ingest | Agent 提修改建议，人审核后合并 |
| 使用时机 | 提问时按语义相似度临时检索片段 | Agent 按页面名读取完整页面 |
| 适合 | 资料多而杂、找原文出处 | 稳定、需要长期维护的结论 |
