// 示例 3：工具调用。模型决定要不要调工具、传什么参数，我们执行后把结果交回模型，让它组织最终回答
// pnpm --filter langchain-demo tool "北京和上海现在几点？"
import {
	type BaseMessage,
	HumanMessage,
	ToolMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { model } from "./model";

const getTime = tool(
	({ timeZone }) =>
		new Date().toLocaleString("zh-CN", { hour12: false, timeZone }),
	{
		description: "查询某个 IANA 时区的当前时间",
		name: "get_time",
		schema: z.object({
			timeZone: z.string().describe("IANA 时区，例如 Asia/Shanghai"),
		}),
	}
);

const modelWithTools = model.bindTools([getTime]);
const MAX_STEPS = 5;

// 模型要调工具就执行，把结果追加进对话再问一次，直到它直接给出回答
async function run(messages: BaseMessage[], step: number): Promise<void> {
	const ai = await modelWithTools.invoke(messages);
	if (!ai.tool_calls?.length || step >= MAX_STEPS) {
		console.log(ai.content);
		return;
	}

	// 一轮里的多个工具调用互不依赖，并行执行
	const results = await Promise.all(
		ai.tool_calls.map(async (call) => {
			console.log(`[调用工具] ${call.name}`, call.args);
			const content = await getTime.invoke(call.args as { timeZone: string });
			return new ToolMessage({ content, tool_call_id: call.id ?? "" });
		})
	);
	await run([...messages, ai, ...results], step + 1);
}

const question = process.argv.slice(2).join(" ") || "东京和纽约现在几点？";
await run([new HumanMessage(question)], 1);
