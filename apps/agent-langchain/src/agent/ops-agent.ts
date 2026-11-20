import { opsAgentInstructions } from "@jax-workflow-project/ops-core/prompts";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import { createAgent } from "langchain";
import { createChatModel } from "../model";
import { awsTools } from "../tools/aws";
import { searchDocsTool } from "../tools/docs";
import { wikiTools } from "../tools/wiki";
import { historyWindow, toolErrors, wikiGuard } from "./middleware";

// 运维助手：LangChain v1 的 createAgent（底层是一个 LangGraph 图：model_request ⇄ tools 循环）。
// 对应 Mastra 的 new Agent({ instructions, model, tools, memory, ... })，见 apps/agent/src/mastra/agents/ops-agent.ts。
// 系统提示和 Mastra 版共用（packages/ops-core/src/prompts.ts）。
// 所有工具都是只读的：只查证据、给建议，不改动线上任何东西；wiki 只能提交修改建议。

// 一次排障约 6~7 次模型调用：取证 1 + 列页面 1 + 读页面 1~2 + 提建议 1 + 写回答 1，追问时可能还要连查几项。
// 和 Mastra 版的 maxSteps: 10 对齐
export const MAX_STEPS = 10;
// LangGraph 按「超级步」计数，一次模型调用 + 一次工具执行是 2 步，所以上限是 2 × MAX_STEPS + 1
export const RECURSION_LIMIT = MAX_STEPS * 2 + 1;

export const opsTools = [...awsTools, ...wikiTools, searchDocsTool];

// checkpointer 决定多轮记忆存在哪：
// - CLI 传 JsonFileSaver（./file-saver.ts，存到 apps/agent-langchain/.data/checkpoints.json）
// - LangGraph Studio（langgraph dev）不传，由服务端注入它自己的 checkpointer
export function createOpsAgent(checkpointer?: BaseCheckpointSaver) {
	return createAgent({
		checkpointer,
		// 顺序即嵌套顺序：historyWindow 在最外层先截断历史，wikiGuard 再按本轮进度过滤工具、检查输出
		middleware: [historyWindow, wikiGuard, toolErrors],
		model: createChatModel(),
		name: "ops-agent",
		systemPrompt: opsAgentInstructions,
		tools: opsTools,
	});
}
