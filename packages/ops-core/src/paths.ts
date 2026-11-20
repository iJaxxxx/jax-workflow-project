import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

// 从 start 向上找含 pnpm-workspace.yaml 的目录，找不到返回 undefined
function walkUpToWorkspace(start: string): string | undefined {
	const dir = resolve(start);
	if (existsSync(join(dir, "pnpm-workspace.yaml"))) {
		return dir;
	}
	const parent = resolve(dir, "..");
	return parent === dir ? undefined : walkUpToWorkspace(parent);
}

// 定位仓库根：先从工作目录向上找（mastra dev 的工作目录是 apps/agent/src/mastra/public，
// LangGraph dev server 的是 apps/agent-langchain），找不到再从本文件所在目录向上找
export function findRepoRoot(): string {
	const root =
		walkUpToWorkspace(process.cwd()) ?? walkUpToWorkspace(import.meta.dirname);
	if (!root) {
		throw new Error(
			"向上找不到 pnpm-workspace.yaml，无法定位仓库根目录；可设置 OPS_WIKI_DIR 指定 wiki 目录"
		);
	}
	return root;
}
