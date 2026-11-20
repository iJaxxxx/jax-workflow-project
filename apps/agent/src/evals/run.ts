// 跑评测：pnpm --filter agent eval
// 用固定的证据快照（./scenarios.ts）喂给 ops-reporter，三个代码打分器打分。
// 每个场景跑 EVAL_REPEAT 次（默认 2），本地模型输出有随机性，多跑几次看稳定性。
// 只需要本地 Ollama，不需要 aws login。结果另存一份 JSON 到 apps/agent/eval-results/，方便对比改动前后。
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildReportPrompt } from "@jax-workflow-project/ops-core/report-prompt";
import { runEvals } from "@mastra/core/evals";
import { mastra } from "../mastra";
import { agentRoot } from "../mastra/paths";
import { SNAPSHOT_NOW, scenarios } from "./scenarios";
import { explain, scorers } from "./scorers";

const REPEAT = Number(process.env.EVAL_REPEAT ?? 2);
const [, , only] = process.argv;

const selected = scenarios.filter((s) => !only || s.id === only);
if (selected.length === 0) {
	console.error(
		`没有叫 ${only} 的场景，可选：${scenarios.map((s) => s.id).join("、")}`
	);
	process.exit(1);
}

const data = selected.flatMap((scenario) =>
	Array.from({ length: REPEAT }, () => ({
		groundTruth: scenario.expect,
		input: buildReportPrompt({
			evidence: scenario.evidence,
			minutes: 60,
			now: SNAPSHOT_NOW,
			question: scenario.question,
		}),
	}))
);

interface Row {
	forbidden: string[];
	format: number;
	id: string;
	missed: string[];
	noHallucination: number;
	rootCause: number;
}

const rows: Row[] = [];
let index = 0;

console.log(
	`评测 ${selected.length} 个场景 × ${REPEAT} 次 = ${data.length} 次，模型推理较慢，请稍等…\n`
);

await runEvals({
	// 本地模型一次只跑一个，并发只会互相拖慢
	concurrency: 1,
	data,
	onItemComplete: ({ item, scorerResults, targetResult }) => {
		const scenario = selected[Math.floor(index / REPEAT)];
		index += 1;
		const text = (targetResult as { text?: string }).text ?? "";
		const { forbidden, missed } = explain(
			text,
			item.groundTruth as (typeof scenarios)[number]["expect"]
		);
		const row: Row = {
			forbidden,
			format: scorerResults["report-format"]?.score ?? 0,
			id: scenario?.id ?? "?",
			missed,
			noHallucination: scorerResults["no-hallucination"]?.score ?? 0,
			rootCause: scorerResults["root-cause"]?.score ?? 0,
		};
		rows.push(row);
		const notes = [
			missed.length ? `漏了 ${missed.join("、")}` : "",
			forbidden.length ? `出现禁止词 ${forbidden.join("、")}` : "",
		]
			.filter(Boolean)
			.join("；");
		console.log(
			`[${index}/${data.length}] ${row.id}  定位 ${row.rootCause.toFixed(2)}  无编造 ${row.noHallucination}  格式 ${row.format.toFixed(2)}${notes ? `  （${notes}）` : ""}`
		);
	},
	scorers,
	target: mastra.getAgent("opsReporter"),
});

const average = (values: number[]) =>
	values.reduce((sum, v) => sum + v, 0) / (values.length || 1);

console.log("\n场景汇总（各项为平均分）：");
const summary = selected.map((scenario) => {
	const mine = rows.filter((row) => row.id === scenario.id);
	const result = {
		format: average(mine.map((r) => r.format)),
		id: scenario.id,
		noHallucination: average(mine.map((r) => r.noHallucination)),
		rootCause: average(mine.map((r) => r.rootCause)),
		tests: scenario.tests,
	};
	console.log(
		`- ${result.id.padEnd(20)} 定位 ${result.rootCause.toFixed(2)}  无编造 ${result.noHallucination.toFixed(2)}  格式 ${result.format.toFixed(2)}  —— ${result.tests}`
	);
	return result;
});

const overall = {
	format: average(rows.map((r) => r.format)),
	noHallucination: average(rows.map((r) => r.noHallucination)),
	rootCause: average(rows.map((r) => r.rootCause)),
};
console.log(
	`\n总分：定位 ${overall.rootCause.toFixed(2)}  无编造 ${overall.noHallucination.toFixed(2)}  格式 ${overall.format.toFixed(2)}`
);

const dir = join(agentRoot, "eval-results");
await mkdir(dir, { recursive: true });
const file = join(dir, `${new Date().toISOString().replaceAll(":", "-")}.json`);
await writeFile(
	file,
	JSON.stringify(
		{
			model: process.env.OLLAMA_MODEL ?? "qwen3:8b",
			overall,
			repeat: REPEAT,
			rows,
			summary,
		},
		null,
		1
	)
);
console.log(`结果已保存：${file}`);
process.exit(0);
