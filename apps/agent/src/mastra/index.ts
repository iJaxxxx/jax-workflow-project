import { Mastra } from "@mastra/core/mastra";
import { githubAssistant } from "./agents/github-assistant";
import { opsAgent } from "./agents/ops-agent";
import { opsReporter } from "./agents/ops-reporter";
import { opsDiagnosis } from "./workflows/ops-diagnosis";

// `pnpm playground`（mastra dev）会读取这个实例，在 http://localhost:4111 打开调试界面
export const mastra = new Mastra({
	agents: { githubAssistant, opsAgent, opsReporter },
	workflows: { opsDiagnosis },
});
