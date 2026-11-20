// apps/agent 的根目录。
// `mastra dev` 的工作目录是 apps/agent/src/mastra/public（`mastra build` 产物则在 .mastra/output），
// tsx 脚本直接在 apps/agent 运行。先把工作目录还原到 apps/agent，保证几种启动方式读写的是同一批文件。
export const agentRoot = process
	.cwd()
	.replace(/[/\\](src[/\\]mastra[/\\]public|\.mastra[/\\]output)$/, "");
