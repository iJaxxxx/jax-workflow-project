// 排障报告员（不挂工具的 LLM）的输入：用户问题 + 查询范围 + 七项证据。
// Mastra 的 workflow report 步骤、LangChain 的 StateGraph report 节点和评测（apps/agent/src/evals）共用，保证评测测的就是线上用的输入。
export function buildReportPrompt(input: {
	evidence: unknown;
	minutes: number;
	now: string;
	question: string;
}) {
	return `用户的问题：${input.question}
查询范围：最近 ${input.minutes} 分钟，当前时间 ${input.now}

证据：
${JSON.stringify(input.evidence, null, 1)}`;
}
