// 开发一个 specs 模块：后端、前端两条流水线同时跑，每条"先开发、再测试"；Codex 评审等两边都开发完再跑。
//
//   后端：开发 ──► 后端测试（api）──┐
//   前端：开发 ──► 前端测试（ui，还要等后端开发完）──┼──► return 给主流程
//   Codex 评审（等前后端都开发完）───────────────────┘
//
// 用到的 5 个核心语法：
//   1. export const meta   声明（纯字面量）
//   2. phase()             分阶段（进度分组）
//   3. await agent()       派一个 subagent 干活
//   4. return              工作流的产出，回到主流程
//   5. pipeline() / parallel()  流水线 / 并行
//
// args 就是 node scripts/module-plan.mjs <模块> 的输出：
//   { module, base, contract: [task], backend: [task], frontend: [task], verify: { review, api, ui } }
//   task: { id, description, layer, deps: [id], files: [path] }
// 这个 workflow 不提交、不改 specs：勾选和 commit 由主流程拿到结果后做。
// 返回值里每条流水线的 test 和 review 都带 status，主流程按 status 处理，不靠猜 null 的含义：
//   test.status：not-needed（不用测）/ skipped（开发没完成）/ error（agent 出错）/
//                passed / failed / incomplete（AC 写法或测试缺失）/ env（dev 服务没起来），后四种按 acceptance.sh 的退出码
//   review.status：not-needed / skipped / error / failed（脚本报错）/ done

export const meta = {
	name: "jax-module",
	description:
		"开发一个 specs 模块：前端、后端两条流水线并行（各自开发完立刻测试），Codex 评审在两边开发完后同时跑",
	whenToUse:
		"/jax-workflow 的 B 阶段，契约 task 做完、dev 服务已启动之后；args 传 node scripts/module-plan.mjs <模块> 的输出",
	phases: [
		{ title: "Build", detail: "后端、前端各自按依赖分批开发，同一批里改不同文件的 task 并行" },
		{ title: "Test", detail: "后端测试（api）、前端测试（ui）各自在本层开发完后立刻开始" },
		{ title: "Review", detail: "前后端都开发完后，Codex 评审一轮" },
	],
};

// ---------- 输入 ----------

const plan = args;
if (!plan?.module) {
	throw new Error("args 要传 node scripts/module-plan.mjs <模块> 的输出");
}
const { module: moduleName, base } = plan;
const specDir = `specs/${moduleName}`;

// 这些问题在派任何 agent 之前就报错，不要等开发跑完才发现
if ((plan.contract ?? []).length > 0) {
	throw new Error(`契约 task 还没做完：${plan.contract.map((task) => task.id).join("、")}，先做完 B1 再调用`);
}
if (plan.verify?.review && !base) {
	throw new Error("要评审但 tasks.md 的基线提交还没填，先按 B1 第 1 步写入");
}

const LANES = [
	{ key: "backend", layer: "后端", test: "api", testName: "后端测试", tasks: plan.backend ?? [] },
	{ key: "frontend", layer: "前端", test: "ui", testName: "前端测试", tasks: plan.frontend ?? [] },
];

// 前端只依赖契约，不能依赖后端 task（否则两条流水线没法并行）
for (const lane of LANES) {
	const own = new Set(lane.tasks.map((task) => task.id));
	const other = LANES.find((item) => item !== lane);
	for (const task of lane.tasks) {
		const crossDep = task.deps.find((id) => other.tasks.some((item) => item.id === id));
		if (crossDep && !own.has(crossDep)) {
			throw new Error(`${task.id}（${lane.layer}）依赖了${other.layer} task ${crossDep}，改成只依赖契约后再跑`);
		}
	}
}

// ---------- 输出格式 ----------

const TASK_RESULT = {
	type: "object",
	properties: {
		ok: { type: "boolean" },
		summary: { type: "string" },
		changedFiles: { type: "array", items: { type: "string" } },
		blocker: { type: "string" },
	},
	required: ["ok", "summary", "changedFiles"],
};

const TEST_RESULT = {
	type: "object",
	properties: {
		specFile: { type: "string" },
		passed: { type: "array", items: { type: "string" } },
		failed: {
			type: "array",
			items: {
				type: "object",
				properties: {
					ac: { type: "string" },
					reason: { type: "string" },
					likelyCause: { type: "string", enum: ["业务代码", "测试本身", "环境"] },
				},
				required: ["ac", "reason", "likelyCause"],
			},
		},
		exitCode: { type: "integer" },
	},
	required: ["specFile", "passed", "failed", "exitCode"],
};

const REVIEW_RESULT = {
	type: "object",
	properties: {
		ok: { type: "boolean" },
		output: { type: "string" },
	},
	required: ["ok", "output"],
};

// ---------- 普通代码：排批次（依赖满足的进同一批；同一批里改同一个文件的拆到下一批） ----------

const toWaves = (tasks) => {
	const ids = new Set(tasks.map((task) => task.id));
	const placed = new Set();
	const waves = [];
	let rest = tasks;
	while (rest.length > 0) {
		const ready = rest.filter((task) => task.deps.every((id) => !ids.has(id) || placed.has(id)));
		if (ready.length === 0) {
			throw new Error(`task 依赖有环：${rest.map((task) => task.id).join("、")}`);
		}
		const wave = [];
		const usedFiles = new Set();
		for (const task of ready) {
			if (task.files.some((file) => usedFiles.has(file))) {
				continue;
			}
			wave.push(task);
			for (const file of task.files) {
				usedFiles.add(file);
			}
		}
		for (const task of wave) {
			placed.add(task.id);
		}
		waves.push(wave);
		rest = rest.filter((task) => !placed.has(task.id));
	}
	return waves;
};

// 先排好批次：依赖有环就在派任何 agent 之前报错
for (const lane of LANES) {
	lane.waves = toWaves(lane.tasks);
}

// acceptance.sh 的退出码 → test.status
const TEST_STATUS = { 0: "passed", 1: "failed", 2: "incomplete", 3: "env" };

// 等另一条流水线开发完（前端测试要等后端、评审要等两边）
const deferred = () => {
	let resolve;
	const promise = new Promise((done) => {
		resolve = done;
	});
	return { promise, resolve };
};
const buildDone = Object.fromEntries(LANES.map((lane) => [lane.key, deferred()]));

// ---------- prompt ----------

const buildPrompt = (lane, task) =>
	[
		`你在开发模块 ${moduleName} 的 task ${task.id}（${lane.layer}）：${task.description}`,
		`允许修改或新建的文件：${task.files.join("、") || "（task 没列文件，只改完成这条 task 必需的文件）"}`,
		`先读 ${specDir}/requirements.md 和 ${specDir}/design.md，不读其他模块的 specs。`,
		"数据库和 tRPC 接口签名已经在契约 task 里定好：不要改 prisma schema，不要改接口的入参和出参。确实需要改契约就停下，在 blocker 里说明。",
		"其他 agent 正在同时开发别的 task，不要碰上面列表以外的文件。",
		"不要运行会改工作区或 index 的 git 命令（stash、restore、checkout、reset、clean），不要跑 pnpm fix（格式由 hook 处理），不要运行 prisma generate 或 db:push。",
		"不要 git commit，不要改 specs/ 下的文件。",
		"做完执行 pnpm check-types，只修自己负责的文件里的错误；别人文件里的错误在 summary 里提一句即可。",
		"返回：ok（这条 task 是否完成且类型检查通过）、summary（一两句）、changedFiles（实际改了的文件）、没做完时的 blocker。",
	].join("\n");

const testPrompt = (lane) => {
	const isApi = lane.test === "api";
	const spec = `e2e/${moduleName}.${lane.test}.spec.ts`;
	return [
		`你是模块 ${moduleName} 的${lane.testName}工程师，按需求写测试，不看实现细节来迁就代码。`,
		`读 ${specDir}/requirements.md 里所有"验证: ${lane.test}"的 AC、${specDir}/design.md 的${isApi ? "接口" : "页面"}表、e2e/helpers.ts，参考 e2e/01-admin-access.${lane.test}.spec.ts 的写法。`,
		`为每条"验证: ${lane.test}"的 AC 写测试到 ${spec}，标题以 AC 编号加空格开头（例如 "AC3 ……"）。文件里已有的测试（包括 R- 开头的）保留。`,
		isApi
			? "只用 Playwright 的 request 发 tRPC / HTTP 请求，不开浏览器。"
			: "用 page 在浏览器里像用户一样操作页面；需要准备数据时可以用 request 调接口。",
		"每个测试自己用 signUp 注册新用户，不依赖已有数据，也不依赖其他测试的执行顺序（另一层的测试可能在同时跑）。",
		`写完执行 scripts/acceptance.sh ${moduleName} --layer ${lane.test}（Bash 的 timeout 设成 600000）。`,
		"不要用 test.skip、test.fixme、test.fail，它们会被算成没通过。",
		`只能改 ${spec}：不改业务代码、specs、e2e/helpers.ts（缺工具函数就在 spec 文件里自己写）。`,
		"有测试失败时判断原因：测试本身写错了就改测试再跑；是业务代码的问题就不要改代码、也不要放宽断言，原样报告。",
		"返回：specFile、passed（通过的 AC 编号）、failed（ac、reason、likelyCause）、exitCode（最后一次 acceptance.sh 的退出码）。",
	].join("\n");
};

const reviewPrompt = [
	`在项目根目录执行 scripts/codex-review.sh ${base}，前台等它跑完（要几分钟，Bash 的 timeout 设成 600000）。`,
	"原样返回完整输出，不要总结、不要分级、不要自己评审，也不要修改任何文件。",
	"脚本失败（没找到 codex、没登录、额度用完、网络错误）时 ok=false，output 放报错。",
].join("\n");

// ---------- 流水线的两个阶段 ----------

// 阶段 1：开发一条流水线。批次之间串行，同一批里 parallel() 并行
const buildLane = async (lane) => {
	const results = [];
	const failed = new Set();
	let ok = false;
	try {
		ok = await runWaves(lane, results, failed);
	} finally {
		// 不管怎样都要通知等它的前端测试和评审，否则它们会一直等下去
		buildDone[lane.key].resolve(ok);
	}
	log(`${lane.layer}开发${ok ? "完成" : `有 task 没完成：${[...failed].join("、")}`}`);
	return { lane: lane.key, ok, tasks: results };
};

const runWaves = async (lane, results, failed) => {
	for (const wave of lane.waves) {
		const runnable = wave.filter((task) => !task.deps.some((id) => failed.has(id)));
		for (const task of wave.filter((item) => !runnable.includes(item))) {
			failed.add(task.id);
			results.push({ id: task.id, ok: false, summary: "依赖的 task 没完成，跳过", changedFiles: [] });
		}
		const waveResults = await parallel(
			runnable.map((task) => () =>
				agent(buildPrompt(lane, task), {
					label: `${lane.key}:${task.id}`,
					phase: "Build",
					schema: TASK_RESULT,
				})
			)
		);
		runnable.forEach((task, index) => {
			const result = waveResults[index] ?? { ok: false, summary: "agent 没有返回结果", changedFiles: [] };
			if (!result.ok) {
				failed.add(task.id);
			}
			results.push({ id: task.id, ...result });
		});
	}
	return failed.size === 0;
};

// 阶段 2：本层开发完立刻测试；前端测试还要等后端开发完（页面要调真实接口）
const testLane = async (built, lane) => {
	if (!plan.verify?.[lane.test]) {
		return { ...built, test: { status: "not-needed" } };
	}
	const skip = (reason) => {
		log(`${lane.testName}跳过：${reason}`);
		return { ...built, test: { status: "skipped", reason } };
	};
	if (!built.ok) {
		return skip(`${lane.layer}开发没完成`);
	}
	if (lane.test === "ui" && !(await buildDone.backend.promise)) {
		return skip("后端开发没完成");
	}
	let test = null;
	try {
		test = await agent(testPrompt(lane), {
			label: `test:${lane.test}`,
			phase: "Test",
			schema: TEST_RESULT,
		});
	} catch (error) {
		log(`${lane.testName} agent 出错：${error.message}`);
	}
	if (!test) {
		return { ...built, test: { status: "error", reason: "agent 被跳过或出错" } };
	}
	return { ...built, test: { status: TEST_STATUS[test.exitCode] ?? "error", ...test } };
};

// Codex 评审：等前后端都开发完再跑（评审的是整个模块的改动）
const review = async () => {
	if (!plan.verify?.review) {
		return { status: "not-needed" };
	}
	const allBuilt = await Promise.all(LANES.map((lane) => buildDone[lane.key].promise));
	if (allBuilt.includes(false)) {
		log("Codex 评审跳过：开发没完成");
		return { status: "skipped", reason: "开发没完成" };
	}
	let result = null;
	try {
		// 这个 agent 只是跑脚本、转交输出，不需要高 effort
		result = await agent(reviewPrompt, { label: "codex-review", phase: "Review", schema: REVIEW_RESULT, effort: "low" });
	} catch (error) {
		log(`Codex 评审 agent 出错：${error.message}`);
	}
	if (!result) {
		return { status: "error", reason: "agent 被跳过或出错" };
	}
	return { status: result.ok ? "done" : "failed", output: result.output };
};

// ---------- 主体 ----------

phase("Build");
const [lanes, reviewResult] = await parallel([
	() => pipeline(LANES, buildLane, testLane),
	review,
]);

return {
	module: moduleName,
	lanes: lanes ?? [],
	review: reviewResult ?? { status: "error", reason: "评审流程抛错" },
};
