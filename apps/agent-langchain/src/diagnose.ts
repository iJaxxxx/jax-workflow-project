// 命令行里跑排障图（LangGraph StateGraph）：pnpm --filter agent-langchain diagnose "收藏接口报 5xx，帮我查原因"
// 和 `ops` 的区别：七项证据由代码固定并行查全，模型只写报告。对应 Mastra 版的 pnpm --filter agent diagnose。
import { opsDiagnosis } from "./graph/ops-diagnosis";

const question =
	process.argv.slice(2).join(" ") ||
	"检查一下线上服务最近一小时是否健康，有问题的话帮我找原因";

const result = await opsDiagnosis.invoke({ minutes: 60, question });

for (const [name, item] of Object.entries(result.evidence)) {
	console.log(`[取证] ${name}：${item.error ?? "已查到"}`);
}
console.log(`\n${result.report}`);
