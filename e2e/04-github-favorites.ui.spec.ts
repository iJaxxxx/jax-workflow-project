import { expect, type Page, type Route, test } from "@playwright/test";

// 本模块不需要登录（AWS 接口公开，不经过本仓库的服务端和数据库），所以不调用 signUp。
// 走真实链路的测试只使用固定测试账号 octocat（后端测试用的是 github，两层并行跑互不影响），
// 测试前后都删掉 octocat 的收藏记录。
// 需要空列表、慢响应、错误时，用 page.route 拦截浏览器发往 AWS 的请求，换成测试里的假后端。

// AWS 数据库从暂停中唤醒最长约 25 秒，默认 30 秒超时不够
test.describe.configure({ timeout: 180_000 });

const AWS_URL = "https://lsmygs2ye8.execute-api.ap-southeast-2.amazonaws.com";
const AWS_PATTERN = `${AWS_URL}/**`;
const REAL_LOGIN = "octocat";
const SLOW = { timeout: 60_000 };

const MSG_NOT_FOUND = "没有找到这个 GitHub 用户";
const MSG_INVALID = "用户名只能包含字母、数字和连字符，最长 39 位";
const MSG_GITHUB_DOWN = "GitHub 暂时不可用，请稍后再试";
const MSG_EMPTY = "还没有收藏任何人";
const MSG_NOTE_TOO_LONG = "备注最多 1000 字";

const RE_USERNAME = /GitHub 用户名|用户名/;
const RE_SEARCH = /^查询/;
const RE_SEARCH_REGION = /查询/;
const RE_OCTOCAT = /octocat/i;
const RE_FOLLOWERS = /粉丝\s*\d+/;
const RE_SAVE = /^保存/;
const RE_CONFIRM = /确认|确定/;
const RE_LOADING = /加载中/;
const RE_ADD = /^添加/;
const RE_ADD_OR_ADDED = /^(添加|已添加)$/;
const RE_RETRY = /^重试/;
const RE_NOTE_LABEL = /备注：/;
const RE_ALREADY_DELETED = /已被删除/;

// ---------- 真实链路的工具 ----------

const deleteRealFavorite = async (
	request: import("@playwright/test").APIRequestContext,
	login: string
) => {
	const list = await request.get(`${AWS_URL}/users/list`, { timeout: 60_000 });
	const body = (await list.json()) as {
		users?: { github_id: number | string; login: string }[];
	};
	await Promise.all(
		(body.users ?? [])
			.filter((user) => user.login.toLowerCase() === login.toLowerCase())
			.map((user) =>
				request.post(`${AWS_URL}/users/delete`, {
					data: { github_id: Number(user.github_id) },
					timeout: 60_000,
				})
			)
	);
};

const searchInput = (page: Page) =>
	page.getByRole("textbox", { name: RE_USERNAME });
const searchButton = (page: Page) =>
	page.getByRole("button", { name: RE_SEARCH });
const listRegion = (page: Page) =>
	page.getByRole("region", { name: "收藏列表" });
const listItem = (page: Page, login: string) =>
	listRegion(page)
		.getByRole("listitem")
		.filter({ hasText: new RegExp(`^.*${login}`, "i") });

const searchFor = async (page: Page, username: string) => {
	await searchInput(page).fill(username);
	await searchButton(page).click();
};

/** 通过页面查询并添加，返回列表里这个人的行 */
const addViaUi = async (page: Page, login: string) => {
	await searchFor(page, login);
	await page.getByRole("button", { exact: true, name: "添加" }).click(SLOW);
	const item = listItem(page, login);
	await expect(item).toBeVisible(SLOW);
	return item;
};

// ---------- 假后端 ----------

interface RawUser {
	avatar_url: string | null;
	bio: string | null;
	company: string | null;
	created_at: string;
	followers: number | null;
	github_id: number;
	location: string | null;
	login: string;
	name: string | null;
	note: string | null;
	public_repos: number | null;
	updated_at: string;
}

const rawProfile = (login: string, githubId: number) => ({
	avatar_url: null,
	bio: null,
	company: null,
	followers: 42,
	github_id: githubId,
	location: null,
	login,
	name: `Fake ${login}`,
	public_repos: 3,
});

const rawUser = (login: string, githubId: number, note: string | null) => ({
	...rawProfile(login, githubId),
	created_at: "2026-11-01T00:00:00.000Z",
	note,
	updated_at: "2026-11-01T00:00:00.000Z",
});

interface FakeOptions {
	/** 每个请求放行前延迟的毫秒数 */
	delayMs?: number;
	/** 覆盖某个路径的响应（返回 undefined 表示走默认逻辑） */
	override?: (
		path: string,
		method: string
	) => { body: unknown; status: number } | undefined;
	users?: RawUser[];
}

interface FakeBackend {
	calls: { body: unknown; method: string; path: string }[];
	count: (method: string, path: string) => number;
	users: RawUser[];
}

const json = (route: Route, status: number, body: unknown) =>
	route.fulfill({
		body: JSON.stringify(body),
		contentType: "application/json",
		headers: { "access-control-allow-origin": "*" },
		status,
	});

const mockBackend = async (
	page: Page,
	options: FakeOptions = {}
): Promise<FakeBackend> => {
	const backend: FakeBackend = {
		calls: [],
		count: (method, path) =>
			backend.calls.filter((c) => c.method === method && c.path === path)
				.length,
		users: [...(options.users ?? [])],
	};

	await page.route(AWS_PATTERN, async (route) => {
		const req = route.request();
		const method = req.method();
		if (method === "OPTIONS") {
			await route.fulfill({
				headers: {
					"access-control-allow-headers": "content-type",
					"access-control-allow-methods": "GET,POST,OPTIONS",
					"access-control-allow-origin": "*",
				},
				status: 204,
			});
			return;
		}
		const url = new URL(req.url());
		const path = url.pathname;
		let body: unknown = null;
		try {
			body = req.postDataJSON();
		} catch {
			body = req.postData();
		}
		backend.calls.push({ body, method, path });

		if (options.delayMs) {
			await new Promise((resolve) => setTimeout(resolve, options.delayMs));
		}

		const overridden = options.override?.(path, method);
		if (overridden) {
			await json(route, overridden.status, overridden.body);
			return;
		}

		const record = body as { github_id?: number; note?: string | null } | null;
		if (path === "/users/list") {
			await json(route, 200, {
				count: backend.users.length,
				users: backend.users,
			});
		} else if (path === "/github") {
			const login = url.searchParams.get("username") ?? "";
			await json(route, 200, rawProfile(login, 900_000_001));
		} else if (path === "/users/create") {
			const profile = body as RawUser;
			const user = {
				...rawUser(profile.login, Number(profile.github_id), null),
				...profile,
				note: null,
			};
			backend.users = [
				user,
				...backend.users.filter((u) => u.github_id !== user.github_id),
			];
			await json(route, 200, { user });
		} else if (path === "/users/update") {
			const target = backend.users.find(
				(u) => u.github_id === Number(record?.github_id)
			);
			if (!target) {
				await json(route, 404, { error: "user not found" });
				return;
			}
			target.note = record?.note ?? null;
			await json(route, 200, { user: target });
		} else if (path === "/users/delete") {
			const id = Number(record?.github_id);
			const exists = backend.users.some((u) => u.github_id === id);
			backend.users = backend.users.filter((u) => u.github_id !== id);
			if (exists) {
				await json(route, 200, { github_id: id });
			} else {
				await json(route, 404, { error: "user not found" });
			}
		} else {
			await json(route, 404, { error: "not found" });
		}
	});

	return backend;
};

// ---------- 真实链路 ----------

test.describe("真实链路（octocat）", () => {
	test.beforeEach(async ({ request }) => {
		await deleteRealFavorite(request, REAL_LOGIN);
	});
	test.afterEach(async ({ request }) => {
		await deleteRealFavorite(request, REAL_LOGIN);
	});

	test("AC8 /github 顶部是输入框和查询按钮，下方是收藏列表，输入为空时查询不可点", async ({
		page,
	}) => {
		await page.goto("/github");
		const input = searchInput(page);
		const button = searchButton(page);
		await expect(input).toBeVisible();
		await expect(button).toBeVisible();
		await expect(input).toHaveValue("");
		await expect(button).toBeDisabled();

		const list = listRegion(page);
		await expect(list).toBeVisible();
		const inputBox = await input.boundingBox();
		const listBox = await list.boundingBox();
		expect(inputBox && listBox && listBox.y > inputBox.y).toBe(true);

		await input.fill("   ");
		await expect(button).toBeDisabled();
		await input.fill("octocat");
		await expect(button).toBeEnabled();
		await input.fill("");
		await expect(button).toBeDisabled();
	});

	test("AC9 查询存在的用户名显示头像、用户名、姓名、粉丝数和添加按钮", async ({
		page,
	}) => {
		await page.goto("/github");
		await searchFor(page, REAL_LOGIN);
		const addButton = page.getByRole("button", { exact: true, name: "添加" });
		await expect(addButton).toBeVisible(SLOW);
		await expect(addButton).toBeEnabled();

		const search = page.getByRole("region", { name: RE_SEARCH_REGION });
		await expect(search.getByRole("img", { name: RE_OCTOCAT })).toBeVisible();
		await expect(search.getByText(REAL_LOGIN, { exact: true })).toBeVisible();
		await expect(search.getByText("The Octocat")).toBeVisible();
		await expect(search.getByText(RE_FOLLOWERS)).toBeVisible();

		// 回车也能查询
		await page.reload();
		await searchInput(page).fill(REAL_LOGIN);
		await searchInput(page).press("Enter");
		await expect(
			page.getByRole("button", { exact: true, name: "添加" })
		).toBeVisible(SLOW);
	});

	test("AC10 点添加后出现在收藏列表，按钮变为已添加且不可点", async ({
		page,
	}) => {
		await page.goto("/github");
		await addViaUi(page, REAL_LOGIN);
		const added = page.getByRole("button", { exact: true, name: "已添加" });
		await expect(added).toBeVisible(SLOW);
		await expect(added).toBeDisabled();
	});

	test("AC11 编辑备注并保存后显示新备注，刷新后仍在", async ({ page }) => {
		await page.goto("/github");
		const item = await addViaUi(page, REAL_LOGIN);
		const note = `e2e 备注 ${Date.now()}`;

		await item.getByRole("button", { name: "编辑备注" }).click();
		await item.getByRole("textbox").fill(note);
		await item.getByRole("button", { name: RE_SAVE }).click();
		// 保存成功后编辑框关闭，列表里显示新备注
		await expect(item.getByRole("textbox")).toHaveCount(0, SLOW);
		await expect(item.getByText(note)).toBeVisible(SLOW);

		await page.reload();
		await expect(listItem(page, REAL_LOGIN).getByText(note)).toBeVisible(SLOW);
	});

	test("AC12 删除时取消不删，确认后从列表消失", async ({ page }) => {
		await page.goto("/github");
		const item = await addViaUi(page, REAL_LOGIN);

		await item.getByRole("button", { exact: true, name: "删除" }).click();
		let dialog = page.getByRole("alertdialog");
		await expect(dialog).toBeVisible();
		await dialog.getByRole("button", { name: "取消" }).click();
		await expect(dialog).toBeHidden();
		await expect(item).toBeVisible();

		await item.getByRole("button", { exact: true, name: "删除" }).click();
		dialog = page.getByRole("alertdialog");
		await dialog.getByRole("button", { name: RE_CONFIRM }).click();
		// 确认框打开时列表被设成 aria-hidden，要等确认框关掉再看列表
		await expect(dialog).toBeHidden(SLOW);
		await expect(listRegion(page).getByText(REAL_LOGIN)).toHaveCount(0, SLOW);

		await page.reload();
		await expect(listRegion(page)).toBeVisible();
		// 等列表加载完成后再确认确实没有
		await expect(page.getByText(RE_LOADING)).toHaveCount(0, SLOW);
		await expect(listItem(page, REAL_LOGIN)).toHaveCount(0);
	});

	test("AC13 查询不存在的用户名显示没有找到，不显示添加按钮", async ({
		page,
	}) => {
		await page.goto("/github");
		await searchFor(page, "e2e-no-such-user-zq9x7k2m4p");
		await expect(page.getByText(MSG_NOT_FOUND)).toBeVisible(SLOW);
		await expect(
			page.getByRole("button", { exact: true, name: "添加" })
		).toHaveCount(0);
	});
});

// ---------- 拦截 AWS 请求 ----------

test("AC14 收藏列表接口返回空列表时显示还没有收藏任何人", async ({ page }) => {
	await page.route(`${AWS_URL}/users/list`, (route) =>
		json(route, 200, { count: 0, users: [] })
	);
	await page.goto("/github");
	await expect(listRegion(page).getByText(MSG_EMPTY)).toBeVisible();
});

test("AC15 慢响应时显示加载状态、按钮不可点，连点只发一次请求", async ({
	page,
}) => {
	const backend = await mockBackend(page, { delayMs: 3000 });
	await page.goto("/github");

	// 列表加载期间显示加载状态
	await expect(listRegion(page).getByText(RE_LOADING)).toBeVisible();
	await expect(listRegion(page).getByText(MSG_EMPTY)).toBeVisible({
		timeout: 10_000,
	});

	// 查询进行中按钮不可点，连点 / 连按回车只发 1 次
	await searchInput(page).fill("slowpoke");
	await searchButton(page).click();
	await expect(searchButton(page)).toBeDisabled();
	for (let i = 0; i < 4; i += 1) {
		// biome-ignore lint/performance/noAwaitInLoops: 模拟用户按顺序连续点击
		await searchButton(page).click({ force: true });
		await searchInput(page).press("Enter");
	}
	const addButton = page.getByRole("button", { name: RE_ADD });
	await expect(addButton).toBeVisible({ timeout: 10_000 });
	expect(backend.count("GET", "/github")).toBe(1);

	// 添加进行中按钮不可点，连点只发 1 次
	await addButton.click();
	await expect(addButton).toBeDisabled();
	for (let i = 0; i < 4; i += 1) {
		// biome-ignore lint/performance/noAwaitInLoops: 模拟用户按顺序连续点击
		await addButton.click({ force: true });
	}
	await expect(listItem(page, "slowpoke")).toBeVisible({ timeout: 15_000 });
	await expect(
		page.getByRole("button", { exact: true, name: "已添加" })
	).toBeVisible({ timeout: 10_000 });
	expect(backend.count("POST", "/users/create")).toBe(1);
	expect(backend.count("GET", "/github")).toBe(1);
});

test("AC16 非法用户名提示格式要求，不发 GET /github", async ({ page }) => {
	const backend = await mockBackend(page);
	const githubRequests: string[] = [];
	page.on("request", (req) => {
		if (req.url().startsWith(`${AWS_URL}/github`)) {
			githubRequests.push(req.url());
		}
	});
	await page.goto("/github");
	await searchFor(page, "bad name!");
	await expect(page.getByText(MSG_INVALID)).toBeVisible();

	await searchFor(page, "a".repeat(40));
	await expect(page.getByText(MSG_INVALID)).toBeVisible();

	await page.waitForTimeout(500);
	expect(githubRequests).toHaveLength(0);
	expect(backend.count("GET", "/github")).toBe(0);
});

test("AC17 GitHub 429/502 提示暂时不可用；列表 500 显示重试，查询区仍可用", async ({
	page,
}) => {
	let searchStatus = 429;
	let listFails = true;
	const backend = await mockBackend(page, {
		override: (path) => {
			if (path === "/github" && searchStatus !== 200) {
				return { body: { error: "upstream error" }, status: searchStatus };
			}
			if (path === "/users/list" && listFails) {
				return { body: { error: "internal error" }, status: 500 };
			}
		},
	});
	await page.goto("/github");

	// 列表 500：显示错误和重试
	const retry = listRegion(page).getByRole("button", { name: RE_RETRY });
	await expect(retry).toBeVisible();

	// 查询 429
	await searchFor(page, "someone");
	await expect(page.getByText(MSG_GITHUB_DOWN)).toBeVisible();

	// 查询 502
	searchStatus = 502;
	await searchFor(page, "someone-else");
	await expect(page.getByText(MSG_GITHUB_DOWN)).toHaveCount(1);
	await expect(page.getByText(MSG_GITHUB_DOWN)).toBeVisible();
	expect(backend.count("GET", "/github")).toBe(2);

	// 列表出错时查询区仍可正常使用
	searchStatus = 200;
	await searchFor(page, "works-fine");
	await expect(
		page.getByRole("button", { name: RE_ADD_OR_ADDED })
	).toBeVisible();

	// 点重试重新请求列表
	const before = backend.count("GET", "/users/list");
	listFails = false;
	await retry.click();
	await expect
		.poll(() => backend.count("GET", "/users/list"))
		.toBeGreaterThan(before);
	await expect(listRegion(page).getByText(MSG_EMPTY)).toBeVisible();
});

test("AC18 备注超过 1000 字提示且不发请求；改成空字符串保存时 note 为 null", async ({
	page,
}) => {
	const backend = await mockBackend(page, {
		users: [rawUser("note-user", 900_000_002, "旧备注")],
	});
	await page.goto("/github");
	const item = listItem(page, "note-user");
	await expect(item.getByText("旧备注")).toBeVisible();

	await item.getByRole("button", { name: "编辑备注" }).click();
	const textbox = item.getByRole("textbox");
	await textbox.fill("长".repeat(1001));
	await item.getByRole("button", { name: RE_SAVE }).click();
	await expect(page.getByText(MSG_NOTE_TOO_LONG)).toBeVisible();
	await page.waitForTimeout(500);
	expect(backend.count("POST", "/users/update")).toBe(0);

	await textbox.fill("");
	await item.getByRole("button", { name: RE_SAVE }).click();
	await expect.poll(() => backend.count("POST", "/users/update")).toBe(1);
	const update = backend.calls.find(
		(c) => c.method === "POST" && c.path === "/users/update"
	);
	expect(update).toBeDefined();
	expect((update?.body as { note?: unknown } | undefined)?.note).toBeNull();
	await expect(item.getByRole("textbox")).toHaveCount(0);
	await expect(item.getByText("旧备注")).toHaveCount(0);
	await expect(item.getByText(RE_NOTE_LABEL)).toHaveCount(0);
});

test("AC19 删除时接口返回 404，从列表移除并提示已被删除", async ({ page }) => {
	const backend = await mockBackend(page, {
		override: (path) => {
			if (path === "/users/delete") {
				// 别处已经删掉了：列表里也不再有这个人
				backend.users = [];
				return { body: { error: "user not found" }, status: 404 };
			}
		},
		users: [rawUser("gone-user", 900_000_003, null)],
	});
	await page.goto("/github");
	const item = listItem(page, "gone-user");
	await expect(item).toBeVisible();

	await item.getByRole("button", { exact: true, name: "删除" }).click();
	const dialog = page.getByRole("alertdialog");
	await dialog.getByRole("button", { name: RE_CONFIRM }).click();
	// 确认框打开时列表被设成 aria-hidden，要等确认框关掉再看列表
	await expect(dialog).toBeHidden();
	// 只看列表行：“gone-user 已被删除”提示也在收藏列表区域里，按文本找会匹配到提示本身
	await expect(listItem(page, "gone-user")).toHaveCount(0);
	await expect(page.getByText(RE_ALREADY_DELETED)).toBeVisible();
	expect(backend.count("POST", "/users/delete")).toBe(1);
});
