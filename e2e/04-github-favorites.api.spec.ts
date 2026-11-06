import { expect, test } from "@playwright/test";
import {
	createGithubUsersClient,
	GITHUB_USERS_API_URL,
	GithubUsersApiError,
} from "../packages/github-users/src/client";
import {
	parseFavoriteUser,
	parseGithubProfile,
} from "../packages/github-users/src/schema";

// 本模块不需要登录（AWS 接口公开，不经过本仓库的服务端和数据库），所以不调用 signUp。
// 后端测试直接在 Node 里调用共享客户端请求 AWS；会真实读写线上数据，
// 只使用固定测试账号 `github`，测试结束删除自己添加的记录。

// AWS 数据库从暂停中唤醒最长约 25 秒，默认 30 秒超时不够
test.describe.configure({ timeout: 180_000 });

const client = createGithubUsersClient();
const TEST_LOGIN = "github";
// 不会被收藏的 githubId，用来测 404
const MISSING_GITHUB_ID = 999_999_937;

const removeIfPresent = async (githubId: number) => {
	try {
		await client.delete(githubId);
	} catch (error) {
		if (!(error instanceof GithubUsersApiError && error.status === 404)) {
			throw error;
		}
	}
};

const captureError = async (run: () => Promise<unknown>): Promise<unknown> => {
	try {
		await run();
	} catch (error) {
		return error;
	}
	throw new Error("预期抛错，但调用成功了");
};

/** 统计 run 执行期间发出的 fetch 次数 */
const countFetches = async (run: () => Promise<unknown>) => {
	const original = globalThis.fetch;
	let calls = 0;
	globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
		calls += 1;
		return original(...args);
	}) as typeof fetch;
	try {
		const error = await captureError(run);
		return { calls, error };
	} finally {
		globalThis.fetch = original;
	}
};

test("AC1 查询存在的 GitHub 用户返回资料", async () => {
	const profile = await client.search("octocat");
	expect(typeof profile.githubId).toBe("number");
	expect(profile.githubId).toBe(583_231);
	expect(profile.login.toLowerCase()).toBe("octocat");
	expect(profile).toHaveProperty("name");
	expect(profile).toHaveProperty("avatarUrl");
	expect(typeof profile.avatarUrl).toBe("string");
	expect(typeof profile.followers).toBe("number");
});

test("AC2 不存在的用户名抛 404，非法用户名抛校验错误且不发请求", async () => {
	const missing = `zz-no-such-user-${Date.now().toString(36)}`;
	const notFound = await captureError(() => client.search(missing));
	expect(notFound).toBeInstanceOf(GithubUsersApiError);
	expect((notFound as GithubUsersApiError).status).toBe(404);

	const badNames = ["bad name!", "a b", "foo@bar", "a".repeat(40)];
	let errors: unknown[] = [];
	const { calls } = await countFetches(async () => {
		errors = await Promise.all(
			badNames.map((bad) => captureError(() => client.search(bad)))
		);
		throw new Error("done");
	});
	expect(calls, "非法用户名不应发请求").toBe(0);
	errors.forEach((error, i) => {
		const label = `用户名 ${JSON.stringify(badNames[i])}`;
		expect(error, label).toBeInstanceOf(Error);
		expect(error, label).not.toBeInstanceOf(GithubUsersApiError);
		expect((error as Error).name, label).toBe("ZodError");
	});
});

test("AC3 添加收藏后出现在列表，重复添加不产生重复记录", async () => {
	const profile = await client.search(TEST_LOGIN);
	await removeIfPresent(profile.githubId);
	try {
		await client.create(profile);
		let list = await client.list();
		let mine = list.filter((u) => u.githubId === profile.githubId);
		expect(mine).toHaveLength(1);
		expect(typeof mine[0]?.githubId).toBe("number");
		expect(mine[0]?.login).toBe(profile.login);
		expect(mine[0]?.note).toBeNull();

		await client.create(profile);
		list = await client.list();
		mine = list.filter((u) => u.githubId === profile.githubId);
		expect(mine).toHaveLength(1);
	} finally {
		await removeIfPresent(profile.githubId);
	}
});

test("AC4 修改备注、传 null 清空备注、不存在的 githubId 抛 404", async () => {
	const profile = await client.search(TEST_LOGIN);
	await removeIfPresent(profile.githubId);
	try {
		await client.create(profile);
		const note = `e2e 备注 ${Date.now()}`;
		await client.update(profile.githubId, note);
		let mine = (await client.list()).find(
			(u) => u.githubId === profile.githubId
		);
		expect(mine?.note).toBe(note);

		await client.update(profile.githubId, null);
		mine = (await client.list()).find((u) => u.githubId === profile.githubId);
		expect(mine).toBeDefined();
		expect(mine?.note).toBeNull();

		const error = await captureError(() =>
			client.update(MISSING_GITHUB_ID, "x")
		);
		expect(error).toBeInstanceOf(GithubUsersApiError);
		expect((error as GithubUsersApiError).status).toBe(404);
	} finally {
		await removeIfPresent(profile.githubId);
	}
});

test("AC5 删除收藏后不在列表，再删一次抛 404", async () => {
	const profile = await client.search(TEST_LOGIN);
	await removeIfPresent(profile.githubId);
	try {
		await client.create(profile);
		expect(
			(await client.list()).some((u) => u.githubId === profile.githubId)
		).toBe(true);

		await client.delete(profile.githubId);
		expect(
			(await client.list()).some((u) => u.githubId === profile.githubId)
		).toBe(false);

		const error = await captureError(() => client.delete(profile.githubId));
		expect(error).toBeInstanceOf(GithubUsersApiError);
		expect((error as GithubUsersApiError).status).toBe(404);
	} finally {
		await removeIfPresent(profile.githubId);
	}
});

test("AC6 原始响应的 github_id 是字符串时解析成数字", () => {
	const raw = {
		avatar_url: null,
		bio: null,
		company: null,
		created_at: "2026-11-06T12:49:04.426Z",
		followers: 200_000,
		github_id: "1024025",
		location: null,
		login: "torvalds",
		name: "Linus Torvalds",
		note: null,
		public_repos: null,
		updated_at: "2026-11-06T12:49:04.426Z",
	};
	const favorite = parseFavoriteUser(raw);
	expect(favorite.githubId).toBe(1_024_025);
	expect(typeof favorite.githubId).toBe("number");

	const profile = parseGithubProfile(raw);
	expect(profile.githubId).toBe(1_024_025);
	expect(typeof profile.githubId).toBe("number");
});

test("AC7 来自 localhost:3001 的跨域预检返回允许的来源", async ({
	request,
}) => {
	const response = await request.fetch(`${GITHUB_USERS_API_URL}/users/create`, {
		headers: {
			"access-control-request-headers": "content-type",
			"access-control-request-method": "POST",
			origin: "http://localhost:3001",
		},
		method: "OPTIONS",
	});
	expect(response.headers()["access-control-allow-origin"]).toBe(
		"http://localhost:3001"
	);
});

test("R-1 解析时 followers / public_repos 为 null 的保持 null，不变成 0", () => {
	const profile = parseGithubProfile({
		avatar_url: null,
		bio: null,
		company: null,
		followers: null,
		github_id: 1,
		location: null,
		login: "someone",
		name: null,
		public_repos: null,
	});
	expect(profile.followers).toBeNull();
	expect(profile.publicRepos).toBeNull();
});
