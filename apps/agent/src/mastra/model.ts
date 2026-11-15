// Ollama 提供兼容 OpenAI 的接口（/v1），Mastra 的 model router 可以直接连，不用额外装 provider 包。
// 换模型：先 `ollama pull <模型名>`，再设置 OLLAMA_MODEL 环境变量。
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434/v1";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:8b";

export const localModel = {
	// Ollama 不校验 key，但 OpenAI 兼容客户端要求有值
	apiKey: "ollama",
	id: `ollama/${OLLAMA_MODEL}` as const,
	url: OLLAMA_URL,
};
