# knowledge/raw：原始资料

把未经整理的笔记、排障记录、runbook 草稿等 Markdown 文件放在这里（可以建子目录）。

- 运行 `pnpm --filter @jax-workflow-project/rag ingest` 后，这里和 `docs/` 下的 `.md` 都会被切片、向量化，供 RAG 在提问时检索
- 不需要事先整理格式，但用 `#` 标题分节能让引用更准确
- 新增或修改文件后要重新跑一次 ingest，索引才会更新

整理好的、需要长期维护的知识请放到 Mastra 运维助手的 LLM Wiki（`apps/agent/wiki/`），而不是这里。
