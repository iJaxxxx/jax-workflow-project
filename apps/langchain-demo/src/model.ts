// 所有示例共用的本地模型：LangChain 通过 ChatOllama 调用本机 Ollama（http://localhost:11434）。
// 换模型：先 `ollama pull <模型名>`，再设置 OLLAMA_MODEL 环境变量。
import { ChatOllama } from "@langchain/ollama";

export const model = new ChatOllama({
	baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
	model: process.env.OLLAMA_MODEL ?? "qwen3:8b",
	temperature: 0.3,
	// qwen3 默认会先输出一段思考过程，关掉后回答更快
	think: false,
});
