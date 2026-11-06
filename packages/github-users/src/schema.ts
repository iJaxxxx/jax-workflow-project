import z from "zod";

/** GitHub 用户名：1–39 位，只含字母、数字、连字符 */
export const usernameSchema = z
	.string()
	.trim()
	.regex(
		/^[a-zA-Z0-9-]{1,39}$/,
		"用户名只能包含字母、数字和连字符，最长 39 位"
	);

/** 备注：最长 1000 字，null 表示清空 */
export const noteSchema = z.string().max(1000, "备注最多 1000 字").nullable();

/** GitHub 用户资料（camelCase） */
export const githubProfileSchema = z.object({
	avatarUrl: z.string().nullable(),
	bio: z.string().nullable(),
	company: z.string().nullable(),
	followers: z.number().int().nullable(),
	githubId: z.number().int().positive(),
	location: z.string().nullable(),
	login: z.string(),
	name: z.string().nullable(),
	publicRepos: z.number().int().nullable(),
});
export type GithubProfile = z.infer<typeof githubProfileSchema>;

/** 已收藏的用户 */
export const favoriteUserSchema = githubProfileSchema.extend({
	createdAt: z.string(),
	note: z.string().nullable(),
	updatedAt: z.string(),
});
export type FavoriteUser = z.infer<typeof favoriteUserSchema>;

/** AWS 原始 GitHub 用户（snake_case），解析后转成 camelCase */
const rawGithubProfileSchema = z.object({
	avatar_url: z.string().nullish(),
	bio: z.string().nullish(),
	company: z.string().nullish(),
	followers: z.coerce.number().int().nullish(),
	github_id: z.coerce.number().int().positive(),
	location: z.string().nullish(),
	login: z.string(),
	name: z.string().nullish(),
	public_repos: z.coerce.number().int().nullish(),
});

const rawFavoriteUserSchema = rawGithubProfileSchema.extend({
	created_at: z.string(),
	note: z.string().nullish(),
	updated_at: z.string(),
});

const toProfile = (
	raw: z.infer<typeof rawGithubProfileSchema>
): GithubProfile => ({
	avatarUrl: raw.avatar_url ?? null,
	bio: raw.bio ?? null,
	company: raw.company ?? null,
	followers: raw.followers ?? null,
	githubId: raw.github_id,
	location: raw.location ?? null,
	login: raw.login,
	name: raw.name ?? null,
	publicRepos: raw.public_repos ?? null,
});

/**
 * 把 AWS 返回的 GitHub 用户（snake_case）转成 GithubProfile。
 * github_id 兼容字符串（后端 bigint 可能以字符串返回）。
 */
export const parseGithubProfile = (raw: unknown): GithubProfile =>
	toProfile(rawGithubProfileSchema.parse(raw));

/** 把 AWS 返回的收藏记录（snake_case）转成 FavoriteUser */
export const parseFavoriteUser = (raw: unknown): FavoriteUser => {
	const user = rawFavoriteUserSchema.parse(raw);
	return {
		...toProfile(user),
		createdAt: user.created_at,
		note: user.note ?? null,
		updatedAt: user.updated_at,
	};
};
