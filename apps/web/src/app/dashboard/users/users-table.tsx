"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@jax-workflow-project/ui/components/alert-dialog";
import { Button } from "@jax-workflow-project/ui/components/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@jax-workflow-project/ui/components/empty";
import { Input } from "@jax-workflow-project/ui/components/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@jax-workflow-project/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { useTRPC } from "@/utils/trpc";

const SEARCH_DEBOUNCE_MS = 300;

interface PendingAction {
	banned: boolean;
	id: string;
	name: string;
}

function parsePage(value: string | null): number {
	const page = Number(value);
	return Number.isInteger(page) && page >= 1 ? page : 1;
}

function formatDateTime(value: Date | string): string {
	const date = new Date(value);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function EmptyState({
	hasSearch,
	onReset,
	page,
}: {
	hasSearch: boolean;
	onReset: () => void;
	page: number;
}) {
	if (hasSearch) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyTitle>没有找到匹配的用户</EmptyTitle>
					<EmptyDescription>换个名字或邮箱关键词试试。</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}
	if (page > 1) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyTitle>这一页没有数据</EmptyTitle>
				</EmptyHeader>
				<Button onClick={onReset} variant="outline">
					回到第 1 页
				</Button>
			</Empty>
		);
	}
	return (
		<Empty>
			<EmptyHeader>
				<EmptyTitle>暂无用户</EmptyTitle>
			</EmptyHeader>
		</Empty>
	);
}

export default function UsersTable({
	currentUserId,
}: {
	currentUserId: string;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const page = parsePage(searchParams.get("page"));
	const search = searchParams.get("search") ?? "";
	const [searchInput, setSearchInput] = useState(search);
	const [pending, setPending] = useState<PendingAction | null>(null);

	const updateUrl = (next: { page?: number; search?: string }) => {
		const params = new URLSearchParams(searchParams);
		const nextSearch = (next.search ?? search).trim();
		if (nextSearch) {
			params.set("search", nextSearch);
		} else {
			params.delete("search");
		}
		params.set("page", String(next.page ?? page));
		router.replace(`${pathname}?${params.toString()}` as Route);
	};

	// Debounce typing into the URL; a new search always starts from page 1.
	useEffect(() => {
		if (searchInput.trim() === search) {
			return;
		}
		const timer = setTimeout(() => {
			const params = new URLSearchParams(searchParams);
			const value = searchInput.trim();
			if (value) {
				params.set("search", value);
			} else {
				params.delete("search");
			}
			params.set("page", "1");
			router.replace(`${pathname}?${params.toString()}` as Route);
		}, SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [searchInput, search, searchParams, pathname, router]);

	const listQuery = useQuery(
		trpc.user.list.queryOptions({ page, search: search || undefined })
	);

	const setBanned = useMutation(
		trpc.user.setBanned.mutationOptions({
			onError: (error) => {
				toast.error(error.message);
			},
			onSuccess: async (result) => {
				toast.success(result.banned ? "已禁用该用户" : "已启用该用户");
				setPending(null);
				await queryClient.invalidateQueries({
					queryKey: trpc.user.list.queryKey(),
				});
			},
		})
	);

	const { data } = listQuery;
	const isEmpty = data !== undefined && data.items.length === 0;
	const totalPages = data
		? Math.max(1, Math.ceil(data.total / data.pageSize))
		: 1;

	return (
		<div className="flex flex-col gap-4">
			<form
				className="flex max-w-sm gap-2"
				onSubmit={(e) => {
					e.preventDefault();
					updateUrl({ page: 1, search: searchInput });
				}}
			>
				<Input
					aria-label="按名字或邮箱搜索"
					onChange={(e) => setSearchInput(e.target.value)}
					placeholder="按名字或邮箱搜索"
					value={searchInput}
				/>
				<Button type="submit" variant="outline">
					搜索
				</Button>
			</form>

			{listQuery.status === "pending" ? <Loader /> : null}

			{isEmpty ? (
				<EmptyState
					hasSearch={search !== ""}
					onReset={() => updateUrl({ page: 1 })}
					page={page}
				/>
			) : null}

			{data && data.items.length > 0 ? (
				<>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>名字</TableHead>
								<TableHead>邮箱</TableHead>
								<TableHead>角色</TableHead>
								<TableHead>状态</TableHead>
								<TableHead>注册时间</TableHead>
								<TableHead className="text-right">操作</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.items.map((user) => {
								const isSelf = user.id === currentUserId;
								return (
									<TableRow key={user.id}>
										<TableCell>{user.name}</TableCell>
										<TableCell>{user.email}</TableCell>
										<TableCell>
											{user.role === "admin" ? "管理员" : "普通用户"}
										</TableCell>
										<TableCell>
											{user.banned ? (
												<span className="text-destructive">已禁用</span>
											) : (
												"正常"
											)}
										</TableCell>
										<TableCell>{formatDateTime(user.createdAt)}</TableCell>
										<TableCell className="text-right">
											<Button
												disabled={isSelf && !user.banned}
												onClick={() =>
													setPending({
														banned: !user.banned,
														id: user.id,
														name: user.name,
													})
												}
												size="sm"
												title={isSelf ? "不能禁用自己" : undefined}
												variant={user.banned ? "outline" : "destructive"}
											>
												{user.banned ? "启用" : "禁用"}
											</Button>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>

					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">
							共 {data.total} 个用户，第 {page} / {totalPages} 页
						</span>
						<div className="flex gap-2">
							<Button
								disabled={page <= 1}
								onClick={() => updateUrl({ page: page - 1 })}
								size="sm"
								variant="outline"
							>
								上一页
							</Button>
							<Button
								disabled={page >= totalPages}
								onClick={() => updateUrl({ page: page + 1 })}
								size="sm"
								variant="outline"
							>
								下一页
							</Button>
						</div>
					</div>
				</>
			) : null}

			<AlertDialog
				onOpenChange={(open) => {
					if (!open) {
						setPending(null);
					}
				}}
				open={pending !== null}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{pending?.banned ? "确认禁用该用户？" : "确认启用该用户？"}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{pending?.banned
								? `禁用后「${pending.name}」将无法登录，当前登录状态会立即失效。`
								: `启用后「${pending?.name ?? ""}」可以重新登录。`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={setBanned.isPending}>
							取消
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={setBanned.isPending}
							onClick={() => {
								if (pending) {
									setBanned.mutate({
										banned: pending.banned,
										userId: pending.id,
									});
								}
							}}
							variant={pending?.banned ? "destructive" : "default"}
						>
							{setBanned.isPending ? "处理中..." : "确认"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
