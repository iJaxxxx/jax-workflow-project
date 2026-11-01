import { execFileSync } from "node:child_process";
import type { APIRequestContext } from "@playwright/test";

export const SERVER_URL = "http://localhost:3000";
const WEB_URL = "http://localhost:3001";
const TEST_PASSWORD = "e2e-password-123";

export interface TestUser {
	email: string;
	name: string;
	password: string;
}

let userCount = 0;

const setRole = (email: string, role: "admin" | "user") => {
	execFileSync(
		"pnpm",
		[
			"--filter",
			"@jax-workflow-project/db",
			"exec",
			"prisma",
			"db",
			"execute",
			"--stdin",
		],
		{ input: `UPDATE "user" SET role = '${role}' WHERE email = '${email}';` }
	);
};

const post = async (
	request: APIRequestContext,
	path: string,
	data: Record<string, string>
) => {
	const response = await request.post(`${SERVER_URL}${path}`, {
		data,
		headers: { origin: WEB_URL },
	});
	if (!response.ok()) {
		throw new Error(
			`${path} 失败：${response.status()} ${await response.text()}`
		);
	}
};

/**
 * 注册一个新用户并保持登录（cookie 存在 request 所属的 context 里，页面也能用）。
 * role 为 admin 时直接改库，再重新登录让会话拿到新角色。
 */
export const signUp = async (
	request: APIRequestContext,
	role: "admin" | "user" = "user"
): Promise<TestUser> => {
	userCount += 1;
	const id = `${role}-${process.pid}-${Date.now()}-${userCount}`;
	const user = {
		email: `${id}@e2e.test`,
		name: `E2E ${role} ${userCount}`,
		password: TEST_PASSWORD,
	};
	await post(request, "/api/auth/sign-up/email", user);
	if (role === "admin") {
		setRole(user.email, "admin");
		await post(request, "/api/auth/sign-in/email", {
			email: user.email,
			password: user.password,
		});
	}
	return user;
};
