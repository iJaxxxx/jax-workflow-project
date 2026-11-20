import { join } from "node:path";
import { LibSQLStore } from "@mastra/libsql";
import { agentRoot } from "./paths";

// 对话记录存在 apps/agent/mastra.db（本地 SQLite 文件，已加入 .gitignore）。
// 路径以 apps/agent 为准，几种启动方式的工作目录不同，见 ./paths.ts。
export const storage = new LibSQLStore({
	id: "agent-storage",
	url: process.env.MASTRA_DB_URL ?? `file:${join(agentRoot, "mastra.db")}`,
});
