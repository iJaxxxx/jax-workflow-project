import { Agent } from "@mastra/core/agent";
import { localModel } from "../model";
import { searchGithubRepos } from "../tools/search-github-repos";

export const githubAssistant = new Agent({
	id: "github-assistant",
	instructions: `你是帮用户挑选开源项目的助手，用中文回答。
- 用户想找库或项目时，调用 search-github-repos 工具，关键词翻译成英文。
- 根据工具返回的数据回答，不要编造仓库名、star 数或链接。
- 每个推荐写一句适用场景，附上链接。`,
	model: localModel,
	name: "GitHub 助手",
	tools: { searchGithubRepos },
});
