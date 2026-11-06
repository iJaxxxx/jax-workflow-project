"use client";

import {
	createGithubUsersClient,
	GithubUsersApiError,
} from "@jax-workflow-project/github-users/client";
import {
	type FavoriteUser,
	type GithubProfile,
	usernameSchema,
} from "@jax-workflow-project/github-users/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import z from "zod";

/** 浏览器直连 AWS 的共享客户端 */
export const githubUsersClient = createGithubUsersClient();

export const favoritesQueryKey = ["github-favorites", "list"] as const;

const MESSAGE_NOT_FOUND = "没有找到这个 GitHub 用户";
const MESSAGE_GITHUB_UNAVAILABLE = "GitHub 暂时不可用，请稍后再试";
const MESSAGE_SERVICE_UNAVAILABLE = "服务暂时不可用，请稍后再试";

/** 把客户端抛出的错误转成给用户看的提示 */
export function describeError(error: unknown): string {
	if (error instanceof z.ZodError) {
		return error.issues[0]?.message ?? "输入不合法";
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

/** 写操作成功后，先更新缓存里的这一条，再让列表重新获取 */
function upsertFavorite(
	current: FavoriteUser[] | undefined,
	user: FavoriteUser
): FavoriteUser[] {
	const others = (current ?? []).filter((u) => u.githubId !== user.githubId);
	return [user, ...others];
}

/** 添加收藏 */
export function useAddFavorite() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (profile: GithubProfile) => githubUsersClient.create(profile),
		onSuccess: async (user) => {
			queryClient.setQueryData<FavoriteUser[]>(favoritesQueryKey, (current) =>
				current?.some((u) => u.githubId === user.githubId)
					? current.map((u) => (u.githubId === user.githubId ? user : u))
					: upsertFavorite(current, user)
			);
			await queryClient.invalidateQueries({ queryKey: favoritesQueryKey });
		},
	});
}

/** 修改备注；空字符串当作清空（null） */
export function useUpdateNote() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			githubId,
			note,
		}: {
			githubId: number;
			note: string | null;
		}) => githubUsersClient.update(githubId, note?.trim() ? note : null),
		onSuccess: async (user) => {
			queryClient.setQueryData<FavoriteUser[]>(favoritesQueryKey, (current) =>
				current?.map((u) => (u.githubId === user.githubId ? user : u))
			);
			await queryClient.invalidateQueries({ queryKey: favoritesQueryKey });
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
	const queryClient = useQueryClient();
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
		onSuccess: async ({ githubId }) => {
			queryClient.setQueryData<FavoriteUser[]>(favoritesQueryKey, (current) =>
				current?.filter((u) => u.githubId !== githubId)
			);
			await queryClient.invalidateQueries({ queryKey: favoritesQueryKey });
		},
	});
}
