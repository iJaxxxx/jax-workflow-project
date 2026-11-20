import { ChatOllama } from "@langchain/ollama";

// 和 apps/agent（Mastra）用同一套环境变量：OLLAMA_URL / OLLAMA_MODEL。
// Mastra 走 Ollama 的 OpenAI 兼容接口（带 /v1），LangChain 的 ChatOllama 走原生接口，这里把 /v1 去掉（和 packages/rag 一样）。
const OLLAMA_BASE_URL = (
	process.env.OLLAMA_URL ?? "http://localhost:11434"
).replace(/\/v1\/?$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:8b";

// 不设置 temperature / numCtx / keepAlive（Mastra 版也没设）：沿用 Ollama 已加载模型的配置，避免和 Mastra 版、评测抢模型时反复重新加载。
// 不设置 think：qwen3 照常思考（和 Mastra 版一致），ChatOllama 只把最终回答放进 content，思考过程不会混进回答。
export function createChatModel() {
	return new ChatOllama({
		baseUrl: OLLAMA_BASE_URL,
		model: OLLAMA_MODEL,
	});
}
