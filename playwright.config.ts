import { defineConfig } from "@playwright/test";

// 验收测试分两层，可以同时跑：
// - api：后端测试，e2e/<模块名>.api.spec.ts，只发请求，不开浏览器
// - ui：前端测试，e2e/<模块名>.ui.spec.ts，用本机 Chrome，不下载浏览器
// 测试标题以 AC 编号开头（例如 "AC3 未登录访问后台跳转登录页"）。由 scripts/acceptance.sh 调用，跑之前先 scripts/dev.sh up。
const API_SPEC = /\.api\.spec\.ts$/;
const UI_SPEC = /\.ui\.spec\.ts$/;

export default defineConfig({
	fullyParallel: false,
	projects: [
		{
			name: "api",
			// 两层同时跑时各用各的输出目录，互不清理
			outputDir: "test-results/api",
			testMatch: API_SPEC,
		},
		{
			name: "ui",
			outputDir: "test-results/ui",
			testMatch: UI_SPEC,
			use: { channel: "chrome", headless: true },
		},
	],
	testDir: "e2e",
	timeout: 30_000,
	use: { baseURL: "http://localhost:3001" },
	// 每个进程内串行；测试都用新注册的用户，两层并行跑也不会互相影响
	workers: 1,
});
