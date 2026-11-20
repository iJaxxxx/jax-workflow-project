import { join } from "node:path";
import { LibSQLStore } from "@mastra/libsql";

// 对话记录存在 apps/agent/mastra.db（本地 SQLite 文件，已加入 .gitignore）。
// `mastra dev` 的工作目录是 apps/agent/src/mastra/public（`mastra build` 产物则在 .mastra/output），
// tsx 脚本直接在 apps/agent 运行。先把工作目录还原到 apps/agent，保证几种启动方式读写的是同一个文件。
const agentRoot = process
	.cwd()
	.replace(/[/\\](src[/\\]mastra[/\\]public|\.mastra[/\\]output)$/, "");

export const storage = new LibSQLStore({
	id: "agent-storage",
	url: process.env.MASTRA_DB_URL ?? `file:${join(agentRoot, "mastra.db")}`,
});
