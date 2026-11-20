// 三个代码打分器（不用 LLM 当裁判：本地 8B 模型给自己打分不可靠，关键词规则可复现、可解释）。
// 分数都在 0~1 之间。
import { createScorer } from "@mastra/core/evals";
import type { Expectation } from "./scenarios";

// Agent 的输出是消息数组，文本可能在 content.content 或 content.parts 里
function outputText(output: unknown): string {
	if (!Array.isArray(output)) {
		return "";
	}
	return output
		.map((message) => {
			const { content } = message as { content?: unknown };
			if (typeof content === "string") {
				return content;
			}
			const { content: text, parts } = (content ?? {}) as {
				content?: string;
				parts?: { text?: string; type?: string }[];
			};
			if (typeof text === "string" && text) {
				return text;
			}
			return (parts ?? [])
				.filter((part) => part.type === "text")
				.map((part) => part.text ?? "")
				.join("");
		})
		.join("\n");
}

const includes = (text: string, keyword: string) =>
	text.toLowerCase().includes(keyword.toLowerCase());

// 定位是否答对：每组关键词至少命中一个，分数 = 命中组数 / 总组数
export const rootCauseScorer = createScorer({
	description: "报告是否定位到正确的层、接口和报错（关键词分组命中率）",
	id: "root-cause",
	type: "agent",
}).generateScore(({ run }) => {
	const text = outputText(run.output);
	const { mustIncludeAny } = run.groundTruth as Expectation;
	const hit = mustIncludeAny.filter((group) =>
		group.some((keyword) => includes(text, keyword))
	).length;
	return mustIncludeAny.length === 0 ? 1 : hit / mustIncludeAny.length;
});

// 有没有编造或张冠李戴：出现任何一个禁止词就是 0 分
export const noHallucinationScorer = createScorer({
	description: "报告里没有出现证据里不存在的结论（禁止词全部未出现得 1 分）",
	id: "no-hallucination",
	type: "agent",
}).generateScore(({ run }) => {
	const text = outputText(run.output);
	const { mustNotInclude } = run.groundTruth as Expectation;
	return mustNotInclude.some((keyword) => includes(text, keyword)) ? 0 : 1;
});

const REQUIRED_SECTIONS = ["现象", "证据", "根因推测", "建议操作"];

// 格式是否完整：四个小标题都在得 1 分
export const formatScorer = createScorer({
	description: "报告是否包含 现象 / 证据 / 根因推测 / 建议操作 四个部分",
	id: "report-format",
	type: "agent",
}).generateScore(({ run }) => {
	const text = outputText(run.output);
	const present = REQUIRED_SECTIONS.filter((section) =>
		text.includes(section)
	).length;
	return present / REQUIRED_SECTIONS.length;
});

export const scorers = [rootCauseScorer, noHallucinationScorer, formatScorer];

// 失败时打印出来方便看：哪些关键词组没命中、出现了哪个禁止词
export function explain(text: string, expect: Expectation) {
	const missed = expect.mustIncludeAny
		.filter((group) => !group.some((keyword) => includes(text, keyword)))
		.map((group) => group.join("/"));
	const forbidden = expect.mustNotInclude.filter((keyword) =>
		includes(text, keyword)
	);
	return { forbidden, missed };
}
