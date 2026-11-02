import { expect, test } from "@playwright/test";
import { SERVER_URL, signUp } from "./helpers";

// 示例：模块 01 已经人工验收过，这里只补了一条后端测试，作为写 API 验收测试的参考

test("AC7 普通用户请求仅管理员接口返回 FORBIDDEN", async ({ request }) => {
	await signUp(request, "user");
	const input = encodeURIComponent(JSON.stringify({ page: 1 }));
	const response = await request.get(
		`${SERVER_URL}/trpc/user.list?input=${input}`
	);
	expect(response.status()).toBe(403);
});
