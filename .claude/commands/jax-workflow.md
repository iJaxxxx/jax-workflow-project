---
description: 一个入口走完全程：specs 不完整就拆 PRD（默认拆完直接开发，要求人工检查时才停下等确认），完整就断点续跑：契约 → 前后端并行开发 → 评审和前后端测试并行 → 总测试 → 提交
argument-hint: <可选：PRD 路径或链接 / 模块名，例如 docs/prd/admin.md 或 01-user-management；要人工检查 specs 时加 --confirm>
---

你是这个项目的技术负责人。按下面的流程把需求从 PRD 做到交付。流程图见 `docs/workflow.md`。

参数：$ARGUMENTS

- 是文件路径或链接 → 当作 PRD
- 是 `specs/` 下的模块名 → 只做这个模块
- 为空 → 自动判断
- 带 `--confirm`，或者用文字说明了"需要人工检查 / 人工确认 / 拆完先给我看" → **人工检查模式**：拆完 specs 停下来等我确认；否则默认**自动模式**：拆完直接进入开发

这些事由脚本和配置保证，不用你在流程里另外检查：commit 前的 `check-types` / `check`（`scripts/hooks/commit-gate.sh`，没过会拦下提交并给出报错）、禁止 push 和改 `.env`（`.claude/settings.json`）。

## 0. 入口：判断 specs 状态

1. `git status` 有未提交的改动时，先问我怎么处理，不要覆盖
2. 执行 `scripts/codex-review.sh --check`。不可用就把原因告诉我，然后结束（评审只能用 Codex）
3. 按顺序判断，**命中第一条就进入对应阶段**：

| 情况 | 进入 |
|---|---|
| 参数给了新的 PRD | A（`specs/` 已有模块时，先问我"追加"还是"覆盖"） |
| `specs/` 不存在或没有模块 | A（PRD 取 `docs/prd/` 下修改时间最新的文件；没有就让我先放一份，然后结束） |
| 有模块缺 `requirements.md` / `design.md` / `tasks.md` | A，只补缺的模块 |
| `specs/status.md` 是 `状态: 待确认` | 把拆分汇报再给我看一遍，等我确认 |
| `状态: 已确认`，还有 `- [ ]` 的 task | B，从第一个没勾的 task 继续（契约、前后端、`R`、`TA`、`TU`、`TZ` 都按勾选状态续跑） |
| 所有 task 都是 `[x]` | 告诉我已全部完成，结束 |

---

## A. 拆需求（只写 specs，不写业务代码）

1. **了解项目**：看 `apps/`、`packages/` 的目录结构；读 `packages/db/prisma/schema/` 下的 `.prisma`、`packages/api/src/routers/index.ts`、`apps/web/src/app/` 下已有的页面
2. **读 PRD**：PDF 或链接先把内容读出来，读不到就停下来告诉我
3. **按功能模块拆分**：一个模块 = 一个能独立验收的功能；项目里已有的能力不重复拆；按依赖编号，文件夹名用英文短横线，例如 `specs/01-user-management/`
4. **按模板生成**每个模块的三个文件：`docs/templates/requirements.md`、`design.md`、`tasks.md`。已完成的 `specs/03-operation-log/` 可以当参考
5. **自查**：每个模块执行 `scripts/acceptance.sh <模块> --check` 和 `node scripts/module-plan.mjs <模块>`，确认每条 AC 都写了验证方式；PRD 的每个功能点都能在某条 AC 里找到
6. **Codex 审 specs（一次）**：执行 `scripts/codex-spec-review.sh <PRD>`（`run_in_background`）。`[必须改]` 的都改掉，`[建议]` 自己判断；改完不再让 Codex 复审。脚本失败就停下来告诉我
7. **写 `specs/status.md`**：自动模式写 `状态: 已确认`、`人工检查: 否`；人工检查模式写 `状态: 待确认`、`人工检查: 是`

   ```markdown
   状态: 已确认
   人工检查: 否
   PRD: docs/prd/xxx.md

   | 模块 | task 数 | 依赖 |
   |---|---|---|
   ```

8. **汇报**：模块列表、task 数、依赖；各模块"假设"一节的要点；Codex 审出的问题和你怎么改的
9. **按模式往下走**：
   - 自动模式：直接提交 specs（`docs(specs): 拆分 xxx 需求`），进入 B
   - 人工检查模式：这一轮到此结束，等我确认。要改就改完再汇报；确认后把 `status.md` 改成 `状态: 已确认`，提交，进入 B

### 拆分规则

- 每条 AC 都要能得出"通过 / 不通过"：接口行为写 `| 验证: api`（后端测试），页面行为写 `| 验证: ui`（前端测试），确实只能人看的（例如纯视觉效果）写 `| 验证: 人工（原因）`
- `design.md` 里的路径必须对应真实存在的目录；边界情况写"情况 → 期望行为"，不写实现方式
- 每个 task 半小时到一小时、一次提交，都要标 `层`：
  - `契约`：数据库 schema + tRPC 接口签名（zod 入参出参定死，实现先抛 `NOT_IMPLEMENTED`）。放在最前面，前后端都依赖它
  - `后端`：接口实现、权限、事务，文件在 `packages/`、`apps/server/`
  - `前端`：页面和组件，文件在 `apps/web/`。前端只依赖契约，不依赖后端实现，这样两边才能并行
- 依赖只写真正的先后关系；改同一个文件的 task 会被自动排成先后，不用再标"串行 / 可并行"
- 每个模块最后固定四个 task：`R` 代码评审、`TA` 后端测试、`TU` 前端测试、`TZ` 总测试（见 `docs/templates/tasks.md`）
- 中文写，代码标识符保持英文

---

## B. 开发（断点续跑，速度优先）

从第一个还有 `- [ ]` 的模块开始（参数指定了模块就只做那个）。**只读当前模块的 specs**，不读其他模块的。能并行的都并行；互不依赖的命令放在同一条消息里一起发。

```
契约（串行）→ ┬ 后端：开发 → 后端测试 ┬→ 修复 → 总测试（串行）→ 提交
              ├ 前端：开发 → 前端测试 ┤
              └ Codex 评审（两边开发完）┘
```

### B1. 契约（你自己串行做）

1. `tasks.md` 的 `基线提交` 还空着，就把当前 `HEAD` 写进去（评审的起点，中断后也能找回）
2. 执行 `node scripts/module-plan.mjs <模块>`，拿到还没做的 task（按层分组）
3. `contract` 里的 task 由你按顺序做：改 Prisma schema → `pnpm db:push`；在 `packages/api/src/routers/` 写好 procedure 并在 `index.ts` 注册：入参写 `.input(z.object(...))`，**出参必须写 `.output(z.object(...))`**（只 throw 的实现推断出的出参是 `never`，前端会一直报类型错），实现先 `throw new TRPCError({ code: "NOT_IMPLEMENTED" })`。`pnpm db:push` 之后会自动 `prisma generate`。每完成一个就勾上并提交 `feat(模块名): T编号 描述`。提交被 hook 拦下就按报错修好再提交（风格问题先 `pnpm fix`）

### B2. 并行开发 + 并行验证（Workflow）

1. `scripts/dev.sh up`（测试要用；开发中改的代码会热更新）。它不检查数据库；起不来就停下来告诉我，不要改 `.env`
2. 重新执行 `node scripts/module-plan.mjs <模块>`，把输出原样作为 `args` 调用 Workflow 工具：`name: "jax-module"`。它会：
   - 后端、前端是两条**流水线**（`pipeline()`），同时跑，每条都是"开发 → 测试"：
     - 开发：本层 task 按依赖分批，同一批里改不同文件的 task 用 `parallel()` 同时派 agent
     - 测试：本层一开发完立刻开始；后端测试 agent 写并跑 `e2e/<模块>.api.spec.ts`，前端测试 agent 写并跑 `e2e/<模块>.ui.spec.ts`（前端测试还要等后端开发完）。测试 agent 只看需求写测试，不改业务代码
   - Codex 评审（`scripts/codex-review.sh <基线提交>`）和两条流水线并行，等前后端都开发完就开始
   - 前端 task 依赖了后端 task 会直接报错：改成只依赖契约
   - 不提交、不改 `tasks.md`，结果返回给你
3. 等 Workflow 完成的通知，不要轮询。中途中断时，同一个会话里用 `resumeFromRunId` 续跑；换了会话就按 `git status` 的改动和 `tasks.md` 的勾选接着做

### B3. 处理结果（你自己做）

Workflow 返回 `{ lanes: [{ ok, tasks, test }], review }`，`test` 和 `review` 都带 `status`，按 status 处理，不要自己猜：
- `not-needed`：这一项的 task 已经勾过，不用管
- `skipped`：开发没完成被跳过 → 先按第 1 步处理开发，再回 B2
- `error`：agent 被跳过或出错 → 停下来告诉我

1. **Build**：逐个检查 `ok` 的 task（`changedFiles` 是否超出 task 列的文件、类型检查是否通过），每个 task 单独 `git add` 它的文件并提交、勾选。有失败的就自己修或补做，修好后回到 B2 重新调用（只会跑剩下的）
2. **Codex 评审**（`R`，每个模块只评一轮，修完不再调 Codex 复查）：
   - `review.status` 不是 `done` 就不许勾 `R`：`failed`（Codex 脚本报错）就停下来把 `output` 告诉我，不要跳过
   - 分级：P0（会出错、有安全问题）/ P1（逻辑缺陷、边界情况没处理）/ P2（风格、可读性、和需求无关的建议），Codex 的 `[P3]` 归到 P2
   - **P0、P1 先复现再修**：在对应层的 spec 文件里写一个标题以 `R-` 开头的失败测试，确认失败后再修；复现不了的降为 P2 并写明原因
   - P2 记到 `tasks.md` 的"遗留"；勾上 `R`，提交 `fix(模块名): 修复评审问题`
3. **后端 / 前端测试**（`TA` / `TU`）：`test.status` 是 `passed` 才能勾；`incomplete`（测试缺失）就补齐测试或重跑 B2；`env`（dev 服务没起来）就停下来告诉我；`failed` 里 `likelyCause` 是业务代码的就修代码，是环境的就停下来告诉我。修完后两层测试同时重跑（两个后台命令 `scripts/acceptance.sh <模块> --layer api` 和 `--layer ui`），通过的那层勾上并和 spec 文件一起提交。**不许为了通过去改 AC 或放宽测试**

### B4. 总测试（`TZ`，串行）

1. 依次执行 `pnpm check-types`、`pnpm check`、`scripts/acceptance.sh <模块>`（两层串行全跑，并把通过的 AC 勾上）。没通过就修，修完重跑这一步
2. `验证: 人工` 的 AC 用浏览器工具逐条验证，通过后手动勾上
3. 全部通过 → 勾上 `TZ`，提交，`scripts/dev.sh down`

### B5. 收尾

- 还有下一个模块 → 回到 B1
- 全部做完 → 把这次踩过的坑各写一句，追加到 `AGENTS.md` 的"经验"，提交
- 汇报：完成了哪些模块和 task、评审修了什么、遗留的 P2、人工验证的 AC；自动模式下再列出各模块的"假设"，方便我事后核对

---

## 全局规则

- Workflow 里 agent 做的 task 由你检查通过后再勾和提交，agent 不改 `tasks.md`、不提交
- PRD 没写清楚的，按最合理的理解继续，写进 `requirements.md` 的"假设"；只有涉及权限、删除数据、改已有表结构，或者怎么理解都可能做错的，才停下来问我
- 开发阶段不要修改 requirements 和 design 来迁就实现；确实需要改的，先问我
- 同一个错误修了三次还没解决，就停下来汇报
