import {
	createGithubUsersClient,
	GithubUsersApiError,
} from "@jax-workflow-project/github-users/client";
import {
	type FavoriteUser,
	type GithubProfile,
	noteSchema,
	usernameSchema,
} from "@jax-workflow-project/github-users/schema";
import {
	QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";

/** App 直连 AWS 的共享客户端（原生请求不受 CORS 限制） */
export const githubUsersClient = createGithubUsersClient();

/** App 根部 QueryClientProvider 用的实例；失败不自动重试，由用户手动重试 */
export const queryClient = new QueryClient({
	defaultOptions: {
		mutations: { retry: false },
		queries: { retry: false },
	},
});

export const favoritesQueryKey = ["github-favorites", "list"] as const;

export const MESSAGE_NOT_FOUND = "没有找到这个 GitHub 用户";
export const MESSAGE_GITHUB_UNAVAILABLE = "GitHub 暂时不可用，请稍后再试";
export const MESSAGE_SERVICE_UNAVAILABLE = "服务暂时不可用，请稍后再试";
export const MESSAGE_ALREADY_DELETED = "已被删除";
export const MESSAGE_EMPTY_LIST = "还没有收藏任何人";

/** zod 校验错误（native 不直接依赖 zod，按结构判断） */
const readValidationMessage = (error: unknown): string | null => {
	if (
		error instanceof Error &&
		error.name === "ZodError" &&
		"issues" in error &&
		Array.isArray(error.issues)
	) {
		const first: unknown = error.issues[0];
		if (
			typeof first === "object" &&
			first !== null &&
			"message" in first &&
			typeof first.message === "string"
		) {
			return first.message;
		}
		return "输入不合法";
	}
	return null;
};

/** 把客户端抛出的错误转成给用户看的提示 */
export function describeError(error: unknown): string {
	const validation = readValidationMessage(error);
	if (validation) {
		return validation;
	}
	if (error instanceof GithubUsersApiError) {
		if (error.status === 0) {
			return MESSAGE_SERVICE_UNAVAILABLE;
		}
		return error.message || MESSAGE_SERVICE_UNAVAILABLE;
	}
	return MESSAGE_SERVICE_UNAVAILABLE;
}

/** 查询 GitHub 用户时的错误提示 */
export function describeSearchError(error: unknown): string {
	if (error instanceof GithubUsersApiError) {
		if (error.status === 404) {
			return MESSAGE_NOT_FOUND;
		}
		if (error.status === 429 || error.status >= 500) {
			return MESSAGE_GITHUB_UNAVAILABLE;
		}
	}
	return describeError(error);
}

/** 校验用户名，合法返回 null，否则返回提示文案（不发请求） */
export function validateUsername(username: string): string | null {
	const result = usernameSchema.safeParse(username);
	return result.success
		? null
		: (result.error.issues[0]?.message ?? "输入不合法");
}

/** 校验备注，合法返回 null，否则返回提示文案 */
export function validateNote(note: string): string | null {
	const result = noteSchema.safeParse(note);
	return result.success
		? null
		: (result.error.issues[0]?.message ?? "输入不合法");
}

/** 收藏列表 */
export function useFavorites() {
	return useQuery({
		queryFn: () => githubUsersClient.list(),
		queryKey: favoritesQueryKey,
		retry: false,
	});
}

/** 按用户名查询 GitHub 用户；用户名不合法时直接报错，不发请求 */
export function useSearchUser() {
	return useMutation({
		mutationFn: (username: string) => {
			const parsed = usernameSchema.parse(username);
			return githubUsersClient.search(parsed);
		},
	});
}

const replaceOrPrepend = (
	current: FavoriteUser[] | undefined,
	user: FavoriteUser
): FavoriteUser[] => {
	const list = current ?? [];
	return list.some((u) => u.githubId === user.githubId)
		? list.map((u) => (u.githubId === user.githubId ? user : u))
		: [user, ...list];
};

/** 添加收藏；成功后先写入缓存，再让列表重新获取 */
export function useAddFavorite() {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (profile: GithubProfile) => githubUsersClient.create(profile),
		onSuccess: async (user) => {
			client.setQueryData<FavoriteUser[]>(favoritesQueryKey, (current) =>
				replaceOrPrepend(current, user)
			);
			await client.invalidateQueries({ queryKey: favoritesQueryKey });
		},
	});
}

/** 修改备注；空字符串（含只有空格）当作清空（null），超过 1000 字直接报错不发请求 */
export function useUpdateNote() {
	const client = useQueryClient();
	return useMutation({
		mutationFn: ({
			githubId,
			note,
		}: {
			githubId: number;
			note: string | null;
		}) => {
			const value = note?.trim() ? note : null;
			return githubUsersClient.update(githubId, noteSchema.parse(value));
		},
		onSuccess: async (user) => {
			client.setQueryData<FavoriteUser[]>(favoritesQueryKey, (current) =>
				current?.map((u) => (u.githubId === user.githubId ? user : u))
			);
			await client.invalidateQueries({ queryKey: favoritesQueryKey });
		},
	});
}

export interface DeleteFavoriteResult {
	/** 这个人在别处已经被删掉了（接口返回 404） */
	alreadyDeleted: boolean;
	githubId: number;
}

/** 删除收藏；404 视为已被删除，同样从列表移除 */
export function useDeleteFavorite() {
	const client = useQueryClient();
	return useMutation({
		mutationFn: async (githubId: number): Promise<DeleteFavoriteResult> => {
			try {
				await githubUsersClient.delete(githubId);
				return { alreadyDeleted: false, githubId };
			} catch (error) {
				if (error instanceof GithubUsersApiError && error.status === 404) {
					return { alreadyDeleted: true, githubId };
				}
				throw error;
			}
		},
		onSuccess: async ({ alreadyDeleted, githubId }) => {
			client.setQueryData<FavoriteUser[]>(favoritesQueryKey, (current) =>
				current?.filter((u) => u.githubId !== githubId)
			);
			// 404 说明服务端已经没有这个人，本地移除即可；再刷新可能把旧数据带回来
			if (!alreadyDeleted) {
				await client.invalidateQueries({ queryKey: favoritesQueryKey });
			}
		},
	});
}
