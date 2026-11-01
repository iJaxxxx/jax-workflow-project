import { expect, test } from "@playwright/test";
import { SERVER_URL, signUp } from "./helpers";

// 示例：模块 01 已经人工验收过，这里只补了两条，作为写验收测试的参考

test("AC3 未登录访问 /dashboard 跳转到登录页并带上 redirect", async ({
	page,
}) => {
	await page.goto("/dashboard");
	await expect(page).toHaveURL("/login?redirect=%2Fdashboard");
});

test("AC7 普通用户请求仅管理员接口返回 FORBIDDEN", async ({ page }) => {
	await signUp(page.request, "user");
	const input = encodeURIComponent(JSON.stringify({ page: 1 }));
	const response = await page.request.get(
		`${SERVER_URL}/trpc/user.list?input=${input}`
	);
	expect(response.status()).toBe(403);
});
