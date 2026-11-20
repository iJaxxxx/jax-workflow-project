// 示例 2：链 = 提示词模板 → 模型 → 输出解析器，用 .pipe() 串起来（LCEL）
// pnpm --filter langchain-demo chain "TypeScript"
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { model } from "./model";

const prompt = ChatPromptTemplate.fromMessages([
	["system", "你是一名技术讲师，回答控制在 {limit} 字以内"],
	["human", "给初学者讲讲 {topic} 是什么，并举一个例子"],
]);

const chain = prompt.pipe(model).pipe(new StringOutputParser());

const topic = process.argv.slice(2).join(" ") || "TypeScript";
const answer = await chain.invoke({ limit: 150, topic });
console.log(answer);

// batch：同一条链并行处理多个输入
const many = await chain.batch([
	{ limit: 50, topic: "Ollama" },
	{ limit: 50, topic: "向量数据库" },
]);
for (const item of many) {
	console.log("---\n", item);
}
