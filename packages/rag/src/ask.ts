import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
	RunnableLambda,
	RunnablePassthrough,
	RunnableSequence,
} from "@langchain/core/runnables";
import { ChatOllama } from "@langchain/ollama";
import { CHAT_MODEL, DEFAULT_TOP_K, OLLAMA_BASE_URL } from "./config";
import { type DocHit, searchDocs } from "./index";
import { IndexMissingError } from "./store";

const prompt = ChatPromptTemplate.fromMessages([
	[
		"system",
		[
			"你是本项目的文档助手，只根据下面「资料」回答问题，用中文作答。",
			"资料里没有答案时直接说「文档里没有找到相关内容」，不要编造。",
			"回答时可以用 [1]、[2] 这样的编号标注依据来自哪条资料。",
			"",
			"资料：",
			"{context}",
		].join("\n"),
	],
	["human", "{question}"],
]);

const formatContext = (hits: DocHit[]): string =>
	hits
		.map(
			(h, i) =>
				`[${i + 1}] 来源：${h.source}${h.heading ? `（${h.heading}）` : ""}\n${h.content}`
		)
		.join("\n\n");

const main = async () => {
	const question = process.argv.slice(2).join(" ").trim();
	if (!question) {
		console.error(
			'用法：pnpm --filter @jax-workflow-project/rag ask "你的问题"'
		);
		process.exitCode = 1;
		return;
	}

	// qwen3 默认会输出思考过程，关掉 think 只要最终答案
	const llm = new ChatOllama({
		baseUrl: OLLAMA_BASE_URL,
		model: CHAT_MODEL,
		temperature: 0.2,
		think: false,
	});

	// LCEL：检索（并行带上原问题）→ 拼提示词 → 调本地模型 → 解析成字符串
	const retrieve = RunnableLambda.from((q: string) =>
		searchDocs(q, DEFAULT_TOP_K)
	);
	const generate = RunnableSequence.from([
		(input: { hits: DocHit[]; question: string }) => ({
			context: formatContext(input.hits),
			question: input.question,
		}),
		prompt,
		llm,
		new StringOutputParser(),
	]);
	const chain = RunnableSequence.from([
		{ hits: retrieve, question: new RunnablePassthrough<string>() },
		RunnablePassthrough.assign({ answer: generate }),
	]);

	const { answer, hits } = await chain.invoke(question);
	console.log(answer.trim());
	console.log("\n引用：");
	for (const [i, h] of hits.entries()) {
		console.log(
			`  [${i + 1}] ${h.source}${h.heading ? ` — ${h.heading}` : ""}（相似度 ${h.score.toFixed(3)}）`
		);
	}
};

main().catch((error: unknown) => {
	if (error instanceof IndexMissingError) {
		console.error(error.message);
	} else {
		console.error("提问失败：", error instanceof Error ? error.message : error);
		console.error(
			`请确认 Ollama 已启动（${OLLAMA_BASE_URL}），并已拉取模型 ${CHAT_MODEL}。`
		);
	}
	process.exitCode = 1;
});
