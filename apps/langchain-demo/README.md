# langchain-demo

用 LangChain（TS）调用本机 Ollama 模型的三个小例子，和 `apps/agent`（Mastra）互不依赖，方便对照。

前提：Ollama 已启动，模型已拉取（默认 `qwen3:8b`，可用 `OLLAMA_MODEL` 换）。

```bash
pnpm --filter langchain-demo chat    # 1. 直接调用：invoke / stream
pnpm --filter langchain-demo chain   # 2. 链：提示词模板 → 模型 → 解析器，含 batch
pnpm --filter langchain-demo tool    # 3. 工具调用：模型决定调 get_time，执行后再回答
```
