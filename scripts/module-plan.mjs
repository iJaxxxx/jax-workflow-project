#!/usr/bin/env node
// 解析 specs/<模块>/tasks.md，输出这个模块还没做完的 task，按层分组（JSON），给 jax-module workflow 当 args。
//
//   node scripts/module-plan.mjs <模块名>
//
// task 行格式：- [ ] T2 描述 | 依赖: T1 | 文件: a.ts, b.ts | 层: 后端
// 层：契约（数据库 + 接口签名，主流程串行做）/ 后端 / 前端 / 评审 / 后端测试 / 前端测试 / 总测试。
// 没写"层"的旧 task 按文件路径推断：prisma schema → 契约，apps/web → 前端，其他代码 → 后端。
import { readFileSync } from "node:fs";

const TASK_LINE = /^- \[( |x)\] (\S+) (.+)$/;
const FIELD_SEPARATOR = /\s*\|\s*/;
const LIST_SEPARATOR = /\s*[,，]\s*/;
const BASE_LINE = /^基线提交:\s*([0-9a-f]{7,40})/m;

const FIXED_LAYERS = new Map([
	["R", "评审"],
	["TA", "后端测试"],
	["TU", "前端测试"],
	["TZ", "总测试"],
]);
const LAYERS = new Set([
	"契约",
	"后端",
	"前端",
	"评审",
	"后端测试",
	"前端测试",
	"总测试",
]);

const fail = (message) => {
	process.stderr.write(`${message}\n`);
	process.exit(2);
};

const inferLayer = (id, description, files) => {
	if (FIXED_LAYERS.has(id)) {
		return FIXED_LAYERS.get(id);
	}
	if (description.includes("冒烟测试") || description.includes("验收")) {
		return "总测试";
	}
	if (files.some((file) => file.includes("prisma/schema"))) {
		return "契约";
	}
	if (files.length > 0 && files.every((file) => file.startsWith("apps/web/"))) {
		return "前端";
	}
	return "后端";
};

const parseList = (value) =>
	!value || value === "无"
		? []
		: value
				.split(LIST_SEPARATOR)
				.map((item) => item.trim())
				.filter(Boolean);

const parseTask = (line) => {
	const match = TASK_LINE.exec(line);
	if (!match) {
		return null;
	}
	const [, mark, id, rest] = match;
	const [description, ...fields] = rest.split(FIELD_SEPARATOR);
	const field = (name) =>
		fields
			.find((item) => item.startsWith(`${name}:`))
			?.slice(name.length + 1)
			.trim();
	const files = parseList(field("文件")).map((file) =>
		file.replaceAll("`", "")
	);
	const layer = field("层") ?? inferLayer(id, description, files);
	if (!LAYERS.has(layer)) {
		fail(`${id} 的层不认识：${layer}`);
	}
	return {
		deps: parseList(field("依赖")),
		description: description.trim(),
		done: mark === "x",
		files,
		id,
		layer,
	};
};

const [, , moduleName] = process.argv;
if (!moduleName) {
	fail("用法: node scripts/module-plan.mjs <模块名>");
}

const path = `specs/${moduleName}/tasks.md`;
let content = "";
try {
	content = readFileSync(path, "utf8");
} catch {
	fail(`找不到 ${path}`);
}

const tasks = content
	.split("\n")
	.map(parseTask)
	.filter((task) => task !== null);
const pending = tasks.filter((task) => !task.done);
const byLayer = (layer) =>
	pending
		.filter((task) => task.layer === layer)
		.map(({ done: _done, ...task }) => task);

const plan = {
	backend: byLayer("后端"),
	base: BASE_LINE.exec(content)?.[1] ?? null,
	contract: byLayer("契约"),
	final: byLayer("总测试").length > 0,
	frontend: byLayer("前端"),
	module: moduleName,
	verify: {
		api: byLayer("后端测试").length > 0,
		review: byLayer("评审").length > 0,
		ui: byLayer("前端测试").length > 0,
	},
};

process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
