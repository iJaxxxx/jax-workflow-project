import type { FavoriteUser, GithubProfile } from "./schema";

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

	constructor(status: number, message: string) {
		super(message);
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

export const createGithubUsersClient = (
	_baseUrl: string = GITHUB_USERS_API_URL
): GithubUsersClient => {
	const notImplemented = () => Promise.reject(new Error("NOT_IMPLEMENTED"));
	return {
		create: notImplemented,
		delete: notImplemented,
		list: notImplemented,
		search: notImplemented,
		update: notImplemented,
	};
};
