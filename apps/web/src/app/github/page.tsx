import FavoriteList from "./favorite-list";
import SearchPanel from "./search-panel";

export default function GithubPage() {
	return (
		<main className="container mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
			<h1 className="font-semibold text-2xl">GitHub 用户收藏</h1>
			<SearchPanel />
			<FavoriteList />
		</main>
	);
}
