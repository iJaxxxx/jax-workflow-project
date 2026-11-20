// 命令行里让运维助手排障（单轮、不带记忆）：pnpm --filter agent-langchain ops "收藏接口报 5xx，帮我查原因"
// 对应 Mastra 版的 pnpm --filter agent ops。需要先 `aws login`，并且本地 Ollama 在运行。
import { createOpsAgent } from "./agent/ops-agent";
import { runAgentTurn } from "./cli/run-agent";

const question =
	process.argv.slice(2).join(" ") ||
	"检查一下线上服务最近一小时是否健康，有问题的话帮我找原因";

const ok = await runAgentTurn(createOpsAgent(), question);
process.exitCode = ok ? 0 : 1;
