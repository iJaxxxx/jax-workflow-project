// 多轮对话：pnpm --filter agent-langchain chat [线程 id]
// 每行输入一个问题，同一个线程里的对话都记得（LangGraph checkpointer + thread_id），可以接着上一轮追问。
// 记录存在 apps/agent-langchain/.data/checkpoints.json，重启后传同一个线程 id 能接着聊。
// 也可以用管道一次喂多轮：printf '问题1\n问题2\n' | pnpm --filter agent-langchain chat
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { JsonFileSaver } from "./agent/file-saver";
import { createOpsAgent } from "./agent/ops-agent";
import { runAgentTurn } from "./cli/run-agent";

const appRoot = join(import.meta.dirname, "..");
const threadId = process.argv[2] || randomUUID();
const agent = createOpsAgent(
	new JsonFileSaver(join(appRoot, ".data", "checkpoints.json"))
);

console.log(
	`线程 id：${threadId}（下次传同一个 id 可以接着聊；输入 exit 退出）`
);
const lines = createInterface({ input: process.stdin, terminal: false });
process.stdout.write("\n> ");
// for await 逐行读：上一轮跑完才读下一行；管道输入读到结尾时，等最后一轮跑完再退出
for await (const line of lines) {
	const question = line.trim();
	if (question === "exit") {
		break;
	}
	if (question) {
		// 管道输入时终端不会回显，自己打印一遍问题，方便对照
		if (!process.stdin.isTTY) {
			console.log(question);
		}
		await runAgentTurn(agent, question, threadId);
	}
	process.stdout.write("\n> ");
}
process.stdout.write("\n");
