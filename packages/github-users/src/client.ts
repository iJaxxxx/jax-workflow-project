import {
	type FavoriteUser,
	type GithubProfile,
	parseFavoriteUser,
	parseGithubProfile,
	usernameSchema,
} from "./schema";

/** 已部署的 AWS HTTP API（API Gateway `jax-gh-api`） */
export const GITHUB_USERS_API_URL =
	"https://lsmygs2ye8.execute-api.ap-southeast-2.amazonaws.com";

/** 请求超时：数据库从暂停中唤醒最长约 25 秒 */
export const REQUEST_TIMEOUT_MS = 35_000;

/**
 * AWS 接口返回非 2xx 时抛出。
 * status 为 HTTP 状态码；超时或网络错误（含被 CORS 拦截）时为 0。
 */
export class GithubUsersApiError extends Error {
	readonly status: number;

	constructor(status: number, message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "GithubUsersApiError";
		this.status = status;
	}
}

export interface GithubUsersClient {
	/** 新增收藏；已存在则用新资料覆盖（保留备注） */
	create: (profile: GithubProfile) => Promise<FavoriteUser>;
	/** 删除收藏，返回被删除的 githubId */
	delete: (githubId: number) => Promise<{ githubId: number }>;
	/** 收藏列表，按添加时间倒序 */
	list: () => Promise<FavoriteUser[]>;
	/** 按用户名查询 GitHub 用户；用户名不合法时抛 ZodError，不发请求 */
	search: (username: string) => Promise<GithubProfile>;
	/** 修改备注，null 表示清空 */
	update: (githubId: number, note: string | null) => Promise<FavoriteUser>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const readErrorText = (body: unknown, fallback: string): string => {
	if (isRecord(body) && typeof body.error === "string") {
		return body.error;
	}
	return fallback;
};

/** 兼容后端把记录包在 `user` 字段里返回 */
const unwrapUser = (body: unknown): unknown =>
	isRecord(body) && isRecord(body.user) ? body.user : body;

const toProfileBody = (profile: GithubProfile) => ({
	avatar_url: profile.avatarUrl,
	bio: profile.bio,
	company: profile.company,
	followers: profile.followers,
	github_id: profile.githubId,
	location: profile.location,
	login: profile.login,
	name: profile.name,
	public_repos: profile.publicRepos,
});

const parseDeletedId = (body: unknown, fallback: number): number => {
	const deleted = isRecord(body) ? body.deleted : undefined;
	const candidate = isRecord(deleted) ? deleted.github_id : deleted;
	const id = Number(candidate);
	return Number.isInteger(id) && id > 0 ? id : fallback;
};

const TRAILING_SLASHES = /\/+$/;

const parseBody = (text: string): unknown => {
	if (!text) {
		return null;
	}
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
};

const toTransportError = (
	error: unknown,
	timedOut: boolean
): GithubUsersApiError => {
	if (error instanceof GithubUsersApiError) {
		return error;
	}
	const detail = error instanceof Error ? error.message : String(error);
	return new GithubUsersApiError(
		0,
		timedOut ? "request timed out" : `network error: ${detail}`,
		{ cause: error }
	);
};

const readResponse = async (response: Response): Promise<unknown> => {
	const body = parseBody(await response.text());
	if (!response.ok) {
		throw new GithubUsersApiError(
			response.status,
			readErrorText(body, `HTTP ${response.status}`)
		);
	}
	return body;
};

export const createGithubUsersClient = (
	baseUrl: string = GITHUB_USERS_API_URL
): GithubUsersClient => {
	const root = baseUrl.replace(TRAILING_SLASHES, "");

	/** 超时 35 秒；超时、网络错误（含 CORS 拦截）统一抛 status 0 */
	const request = async (
		path: string,
		init?: { body: unknown; method: "POST" }
	): Promise<unknown> => {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
		try {
			const response = await fetch(`${root}${path}`, {
				method: init?.method ?? "GET",
				signal: controller.signal,
				...(init
					? {
							body: JSON.stringify(init.body),
							headers: { "content-type": "application/json" },
						}
					: {}),
			});
			return await readResponse(response);
		} catch (error) {
			throw toTransportError(error, controller.signal.aborted);
		} finally {
			clearTimeout(timer);
		}
	};

	return {
		create: async (profile) =>
			parseFavoriteUser(
				unwrapUser(
					await request("/users/create", {
						body: toProfileBody(profile),
						method: "POST",
					})
				)
			),
		delete: async (githubId) => {
			const body = await request("/users/delete", {
				body: { github_id: githubId },
				method: "POST",
			});
			return { githubId: parseDeletedId(body, githubId) };
		},
		list: async () => {
			const body = await request("/users/list");
			const users =
				isRecord(body) && Array.isArray(body.users) ? body.users : [];
			return users.map((user) => parseFavoriteUser(user));
		},
		search: async (username) => {
			const valid = usernameSchema.parse(username);
			return parseGithubProfile(
				await request(`/github?username=${encodeURIComponent(valid)}`)
			);
		},
		update: async (githubId, note) =>
			parseFavoriteUser(
				unwrapUser(
					await request("/users/update", {
						body: { github_id: githubId, note },
						method: "POST",
					})
				)
			),
	};
};
