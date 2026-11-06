"use client";

import type { GithubProfile } from "@jax-workflow-project/github-users/schema";
import { Button } from "@jax-workflow-project/ui/components/button";
import { Card, CardContent } from "@jax-workflow-project/ui/components/card";
import { Input } from "@jax-workflow-project/ui/components/input";
import { type FormEvent, useState } from "react";

import {
	describeError,
	describeSearchError,
	useAddFavorite,
	useFavorites,
	useSearchUser,
} from "./use-favorites";

export default function SearchPanel() {
	const [username, setUsername] = useState("");
	const search = useSearchUser();
	const add = useAddFavorite();

	const trimmed = username.trim();
	const canSearch = trimmed.length > 0 && !search.isPending;

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!canSearch) {
			return;
		}
		add.reset();
		search.mutate(trimmed);
	};

	return (
		<section aria-label="查询 GitHub 用户" className="flex flex-col gap-3">
			<form className="flex gap-2" onSubmit={handleSubmit}>
				<Input
					aria-label="GitHub 用户名"
					autoComplete="off"
					className="flex-1"
					onChange={(event) => setUsername(event.target.value)}
					placeholder="输入 GitHub 用户名，如 octocat"
					value={username}
				/>
				<Button disabled={!canSearch} type="submit">
					{search.isPending ? "查询中…" : "查询"}
				</Button>
			</form>

			{search.isError ? (
				<p className="text-destructive text-sm" role="alert">
					{describeSearchError(search.error)}
				</p>
			) : null}

			{search.data ? (
				<ResultCard
					addError={add.isError ? describeError(add.error) : null}
					isAdding={add.isPending}
					onAdd={(profile) => add.mutate(profile)}
					profile={search.data}
				/>
			) : null}
		</section>
	);
}

function ResultCard({
	addError,
	isAdding,
	onAdd,
	profile,
}: {
	addError: string | null;
	isAdding: boolean;
	onAdd: (profile: GithubProfile) => void;
	profile: GithubProfile;
}) {
	const favorites = useFavorites();
	const isAdded =
		favorites.data?.some((u) => u.githubId === profile.githubId) ?? false;

	let buttonLabel = "添加";
	if (isAdded) {
		buttonLabel = "已添加";
	} else if (isAdding) {
		buttonLabel = "添加中…";
	}

	return (
		<Card data-testid="search-result">
			<CardContent className="flex items-center gap-4">
				{profile.avatarUrl ? (
					// biome-ignore lint/performance/noImgElement: static export, next/image optimization is unavailable
					// biome-ignore lint/correctness/useImageSize: avatar size is fixed by CSS
					<img
						alt={`${profile.login} 的头像`}
						className="size-12 rounded-full"
						src={profile.avatarUrl}
					/>
				) : (
					<div className="size-12 rounded-full bg-muted" />
				)}
				<div className="flex min-w-0 flex-1 flex-col">
					<span className="font-medium">{profile.login}</span>
					{profile.name ? (
						<span className="text-muted-foreground text-sm">
							{profile.name}
						</span>
					) : null}
					<span className="text-muted-foreground text-sm">
						粉丝 {profile.followers ?? 0}
					</span>
					{addError ? (
						<span className="text-destructive text-sm" role="alert">
							{addError}
						</span>
					) : null}
				</div>
				<Button
					disabled={isAdded || isAdding}
					onClick={() => onAdd(profile)}
					type="button"
				>
					{buttonLabel}
				</Button>
			</CardContent>
		</Card>
	);
}
