"use client";

import {
	type FavoriteUser,
	noteSchema,
} from "@jax-workflow-project/github-users/schema";
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
import { Card, CardContent } from "@jax-workflow-project/ui/components/card";
import { Skeleton } from "@jax-workflow-project/ui/components/skeleton";
import { Textarea } from "@jax-workflow-project/ui/components/textarea";
import { type FormEvent, useState } from "react";

import {
	describeError,
	useDeleteFavorite,
	useFavorites,
	useUpdateNote,
} from "./use-favorites";

const LOADING_ROWS = ["a", "b", "c"];

export default function FavoriteList() {
	const favorites = useFavorites();
	const [notice, setNotice] = useState<string | null>(null);

	return (
		<section aria-label="收藏列表" className="flex flex-col gap-3">
			<h2 className="font-medium text-lg">收藏列表</h2>

			{notice ? (
				<p className="text-muted-foreground text-sm" role="status">
					{notice}
				</p>
			) : null}

			<FavoriteListBody
				favorites={favorites}
				onAlreadyDeleted={(login) => setNotice(`${login} 已被删除`)}
			/>
		</section>
	);
}

function FavoriteListBody({
	favorites,
	onAlreadyDeleted,
}: {
	favorites: ReturnType<typeof useFavorites>;
	onAlreadyDeleted: (login: string) => void;
}) {
	if (favorites.isPending) {
		return (
			<div
				aria-busy="true"
				aria-label="收藏列表加载中"
				className="flex flex-col gap-2"
				data-testid="favorites-loading"
				role="status"
			>
				{LOADING_ROWS.map((key) => (
					<Skeleton className="h-16 w-full" key={key} />
				))}
				<span className="sr-only">加载中…</span>
			</div>
		);
	}

	if (favorites.isError) {
		return (
			<div
				className="flex items-center gap-3"
				data-testid="favorites-error"
				role="alert"
			>
				<span className="text-destructive text-sm">
					收藏列表加载失败：{describeError(favorites.error)}
				</span>
				<Button
					disabled={favorites.isFetching}
					onClick={() => favorites.refetch()}
					size="sm"
					type="button"
					variant="outline"
				>
					{favorites.isFetching ? "重试中…" : "重试"}
				</Button>
			</div>
		);
	}

	if (favorites.data.length === 0) {
		return (
			<p
				className="text-muted-foreground text-sm"
				data-testid="favorites-empty"
			>
				还没有收藏任何人
			</p>
		);
	}

	return (
		<ul className="flex flex-col gap-2" data-testid="favorites-list">
			{favorites.data.map((user) => (
				<FavoriteRow
					key={user.githubId}
					onAlreadyDeleted={onAlreadyDeleted}
					user={user}
				/>
			))}
		</ul>
	);
}

function FavoriteRow({
	onAlreadyDeleted,
	user,
}: {
	onAlreadyDeleted: (login: string) => void;
	user: FavoriteUser;
}) {
	const [isEditing, setIsEditing] = useState(false);

	return (
		<li data-testid="favorite-item">
			<Card>
				<CardContent className="flex flex-col gap-3">
					<div className="flex items-center gap-4">
						{user.avatarUrl ? (
							// biome-ignore lint/performance/noImgElement: static export, next/image optimization is unavailable
							// biome-ignore lint/correctness/useImageSize: avatar size is fixed by CSS
							<img
								alt={`${user.login} 的头像`}
								className="size-12 rounded-full"
								src={user.avatarUrl}
							/>
						) : (
							<div className="size-12 rounded-full bg-muted" />
						)}
						<div className="flex min-w-0 flex-1 flex-col">
							<span className="font-medium">{user.login}</span>
							{user.name ? (
								<span className="text-muted-foreground text-sm">
									{user.name}
								</span>
							) : null}
							<span className="text-muted-foreground text-sm">
								粉丝 {user.followers ?? 0}
							</span>
							{user.note && !isEditing ? (
								<span
									className="whitespace-pre-wrap break-words text-sm"
									data-testid="favorite-note"
								>
									备注：{user.note}
								</span>
							) : null}
						</div>
						<div className="flex shrink-0 gap-2">
							{isEditing ? null : (
								<Button
									onClick={() => setIsEditing(true)}
									size="sm"
									type="button"
									variant="outline"
								>
									编辑备注
								</Button>
							)}
							<DeleteButton onAlreadyDeleted={onAlreadyDeleted} user={user} />
						</div>
					</div>
					{isEditing ? (
						<NoteEditor onDone={() => setIsEditing(false)} user={user} />
					) : null}
				</CardContent>
			</Card>
		</li>
	);
}

function NoteEditor({
	onDone,
	user,
}: {
	onDone: () => void;
	user: FavoriteUser;
}) {
	const [draft, setDraft] = useState(user.note ?? "");
	const [validationError, setValidationError] = useState<string | null>(null);
	const update = useUpdateNote();

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (update.isPending) {
			return;
		}
		const parsed = noteSchema.safeParse(draft);
		if (!parsed.success) {
			setValidationError(parsed.error.issues[0]?.message ?? "备注不合法");
			return;
		}
		setValidationError(null);
		update.mutate(
			{ githubId: user.githubId, note: parsed.data },
			{ onSuccess: onDone }
		);
	};

	let errorText: string | null = validationError;
	if (!errorText && update.isError) {
		errorText = describeError(update.error);
	}

	return (
		<form className="flex flex-col gap-2" onSubmit={handleSubmit}>
			<Textarea
				aria-invalid={validationError ? true : undefined}
				aria-label={`${user.login} 的备注`}
				onChange={(event) => {
					setDraft(event.target.value);
					if (validationError) {
						setValidationError(null);
					}
				}}
				placeholder="输入备注（最多 1000 字），留空即清空备注"
				value={draft}
			/>
			{errorText ? (
				<p className="text-destructive text-sm" role="alert">
					{errorText}
				</p>
			) : null}
			<div className="flex justify-end gap-2">
				<Button
					disabled={update.isPending}
					onClick={onDone}
					size="sm"
					type="button"
					variant="outline"
				>
					取消
				</Button>
				<Button disabled={update.isPending} size="sm" type="submit">
					{update.isPending ? "保存中…" : "保存"}
				</Button>
			</div>
		</form>
	);
}

function DeleteButton({
	onAlreadyDeleted,
	user,
}: {
	onAlreadyDeleted: (login: string) => void;
	user: FavoriteUser;
}) {
	const [open, setOpen] = useState(false);
	const remove = useDeleteFavorite();

	const handleConfirm = () => {
		if (remove.isPending) {
			return;
		}
		// 成功后这一行会从缓存里移除、组件随之卸载，而 TanStack Query 不会对已卸载组件执行
		// mutate 的单次回调；用 mutateAsync 的 Promise 结果来通知父组件（父组件仍在页面上）
		remove
			.mutateAsync(user.githubId)
			.then(({ alreadyDeleted }) => {
				setOpen(false);
				if (alreadyDeleted) {
					onAlreadyDeleted(user.login);
				}
			})
			.catch(() => {
				// 错误由 remove.error 在弹窗里显示
			});
	};

	return (
		<AlertDialog
			onOpenChange={(next) => {
				if (!remove.isPending) {
					setOpen(next);
					if (next) {
						remove.reset();
					}
				}
			}}
			open={open}
		>
			<Button
				disabled={remove.isPending}
				onClick={() => {
					remove.reset();
					setOpen(true);
				}}
				size="sm"
				type="button"
				variant="destructive"
			>
				删除
			</Button>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>删除收藏</AlertDialogTitle>
					<AlertDialogDescription>
						确定要把 {user.login} 从收藏列表删除吗？
					</AlertDialogDescription>
				</AlertDialogHeader>
				{remove.isError ? (
					<p className="text-destructive text-sm" role="alert">
						{describeError(remove.error)}
					</p>
				) : null}
				<AlertDialogFooter>
					<AlertDialogCancel disabled={remove.isPending}>
						取消
					</AlertDialogCancel>
					<AlertDialogAction
						disabled={remove.isPending}
						onClick={handleConfirm}
						variant="destructive"
					>
						{remove.isPending ? "删除中…" : "确认删除"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
