import { defineConfig } from "@playwright/test";

// 验收测试：每个模块一个 e2e/<模块名>.spec.ts，测试标题以 AC 编号开头（例如 "AC3 未登录访问后台跳转登录页"）。
// 由 scripts/acceptance.sh 调用；跑之前先 scripts/dev.sh up。用本机 Chrome，不下载浏览器。
export default defineConfig({
	fullyParallel: false,
	testDir: "e2e",
	timeout: 30_000,
	use: {
		baseURL: "http://localhost:3001",
		channel: "chrome",
		headless: true,
	},
	// 测试共用一个数据库，串行跑避免互相影响
	workers: 1,
});
