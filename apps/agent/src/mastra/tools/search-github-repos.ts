import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const repoSchema = z.object({
	description: z.string().nullable(),
	fullName: z.string(),
	language: z.string().nullable(),
	stars: z.number(),
	url: z.string(),
});

interface GithubSearchResponse {
	items: {
		full_name: string;
		description: string | null;
		stargazers_count: number;
		language: string | null;
		html_url: string;
	}[];
}

export const searchGithubRepos = createTool({
	description:
		"按关键词搜索 GitHub 公开仓库，按 star 数从高到低返回。用户想找开源库、项目或工具时使用。",
	execute: async ({ query, limit }) => {
		const url = new URL("https://api.github.com/search/repositories");
		url.searchParams.set("q", query);
		url.searchParams.set("sort", "stars");
		url.searchParams.set("per_page", String(limit));

		const res = await fetch(url, {
			headers: { Accept: "application/vnd.github+json" },
		});
		if (!res.ok) {
			throw new Error(`GitHub 搜索失败：${res.status} ${res.statusText}`);
		}
		const data = (await res.json()) as GithubSearchResponse;

		return {
			repos: data.items.map((item) => ({
				description: item.description,
				fullName: item.full_name,
				language: item.language,
				stars: item.stargazers_count,
				url: item.html_url,
			})),
		};
	},
	id: "search-github-repos",
	inputSchema: z.object({
		limit: z.number().int().min(1).max(10).default(5),
		query: z
			.string()
			.describe("搜索关键词，用英文，例如 'react state management'"),
	}),
	outputSchema: z.object({ repos: z.array(repoSchema) }),
});
