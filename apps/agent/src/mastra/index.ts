import { Mastra } from "@mastra/core/mastra";
import { githubAssistant } from "./agents/github-assistant";
import { opsAgent } from "./agents/ops-agent";
import { opsReporter } from "./agents/ops-reporter";
import { storage } from "./storage";
import { opsDiagnosis } from "./workflows/ops-diagnosis";

// `pnpm playground`（mastra dev）会读取这个实例，在 http://localhost:4111 打开调试界面
export const mastra = new Mastra({
	agents: { githubAssistant, opsAgent, opsReporter },
	// packages/rag、packages/ops-core 是没编译的 TypeScript 源码（相对导入不带 .js 后缀），
	// mastra dev 不显式列出时会让 Node 直接加载 .ts 源码，导致模块解析失败、服务崩溃
	bundler: {
		transpilePackages: [
			"@jax-workflow-project/ops-core",
			"@jax-workflow-project/rag",
		],
	},
	// 对话线程、workflow 运行记录都存在这里，重启和切换页面不会丢
	storage,
	workflows: { opsDiagnosis },
});
