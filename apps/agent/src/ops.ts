// 命令行里让运维助手排障：pnpm --filter agent ops "收藏接口报 5xx，帮我查原因"
// 需要先 `aws login`，并且本地 Ollama 在运行。
import { mastra } from "./mastra";

const question =
	process.argv.slice(2).join(" ") ||
	"检查一下线上服务最近一小时是否健康，有问题的话帮我找原因";

const MAX_STEPS = 8;

const agent = mastra.getAgent("opsAgent");
// 一次排障要连续调多个工具，步数上限给够
const stream = await agent.stream(question, { maxSteps: MAX_STEPS });

for await (const chunk of stream.fullStream) {
	if (chunk.type === "tool-call") {
		console.log(`\n[调用工具] ${chunk.payload.toolName}`, chunk.payload.args);
	} else if (chunk.type === "tool-error") {
		const { error, toolName } = chunk.payload;
		// 只打印一句话，不打印整段堆栈
		console.log(
			`[工具报错] ${toolName}：${error instanceof Error ? error.message : String(error)}`
		);
	} else if (chunk.type === "text-delta") {
		process.stdout.write(chunk.payload.text);
	}
}
process.stdout.write("\n");
