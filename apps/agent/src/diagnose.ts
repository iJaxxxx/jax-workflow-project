// 命令行里跑排障 workflow：pnpm --filter agent diagnose "收藏接口报 5xx，帮我查原因"
// 和 `ops` 的区别：七项证据由代码固定查全，模型只写报告。需要先 `aws login`，并且本地 Ollama 在运行。
import { mastra } from "./mastra";

const question =
	process.argv.slice(2).join(" ") ||
	"检查一下线上服务最近一小时是否健康，有问题的话帮我找原因";

const run = await mastra.getWorkflow("opsDiagnosis").createRun();
const result = await run.start({ inputData: { minutes: 60, question } });

if (result.status !== "success") {
	console.error(`workflow 没有跑完，状态：${result.status}`);
	process.exit(1);
}

for (const [name, item] of Object.entries(result.result.evidence)) {
	console.log(`[取证] ${name}：${item.error ?? "已查到"}`);
}
console.log(`\n${result.result.report}`);
