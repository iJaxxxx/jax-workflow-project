import { expect, test } from "@playwright/test";

// 示例：模块 01 已经人工验收过，这里只补了一条前端测试，作为写 UI 验收测试的参考

test("AC3 未登录访问 /dashboard 跳转到登录页并带上 redirect", async ({
	page,
}) => {
	await page.goto("/dashboard");
	await expect(page).toHaveURL("/login?redirect=%2Fdashboard");
});
