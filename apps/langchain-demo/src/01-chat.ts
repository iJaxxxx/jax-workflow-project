// 示例 1：直接调用模型，先一次性拿结果，再流式输出
// pnpm --filter langchain-demo chat "用一句话介绍 LangChain"
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { model } from "./model";

const question = process.argv.slice(2).join(" ") || "用一句话介绍 LangChain";

// invoke：等模型说完，拿到完整的 AIMessage
const res = await model.invoke([
	new SystemMessage("你是一个简洁的中文助手"),
	new HumanMessage(question),
]);
console.log("[invoke]", res.content);

// stream：边生成边打印
process.stdout.write("[stream] ");
for await (const chunk of await model.stream(
	"再用一句话说说它和直接调 Ollama API 有什么不同"
)) {
	process.stdout.write(String(chunk.content));
}
process.stdout.write("\n");
