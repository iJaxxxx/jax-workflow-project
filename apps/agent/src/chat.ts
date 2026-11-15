// 命令行里问一句：pnpm --filter agent chat "帮我找几个 React 状态管理库"
import { mastra } from "./mastra";

const question =
	process.argv.slice(2).join(" ") || "帮我找 3 个 React 状态管理库";

const agent = mastra.getAgent("githubAssistant");
const stream = await agent.stream(question);

for await (const chunk of stream.fullStream) {
	if (chunk.type === "tool-call") {
		console.log(`\n[调用工具] ${chunk.payload.toolName}`, chunk.payload.args);
	} else if (chunk.type === "text-delta") {
		process.stdout.write(chunk.payload.text);
	}
}
process.stdout.write("\n");
