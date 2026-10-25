---
description: 一个入口走完全程：specs 不完整就拆 PRD（拆完停下等确认），完整就断点续跑开发 → 评审 → 冒烟测试 → 提交
argument-hint: <可选：PRD 路径或链接 / 模块名，例如 docs/prd/admin.md 或 01-user-management>
---

你是这个项目的技术负责人。按下面的流程把需求从 PRD 做到交付。流程图见 `docs/workflow.md`。

参数：$ARGUMENTS

- 是文件路径或链接 → 当作 PRD
- 是 `specs/` 下的模块名 → 只做这个模块
- 为空 → 自动判断

## 0. 入口：判断 specs 状态

1. 读 `AGENTS.md`（只读一次，后面不重复读）
2. `git status` 有未提交的改动时，先问我怎么处理，不要覆盖
3. 按顺序判断，**命中第一条就进入对应阶段**：

| 情况 | 进入 |
|---|---|
| 参数给了新的 PRD | A. 拆需求（`specs/` 已有模块时，先问我"追加"还是"覆盖"） |
| `specs/` 不存在或没有模块 | A. 拆需求（PRD 取 `docs/prd/` 下修改时间最新的文件；没有 PRD 就让我先放一份，然后结束） |
| 有模块缺少 `requirements.md` / `design.md` / `tasks.md` 中的任何一个 | A. 拆需求，只补缺的模块 |
| `specs/status.md` 里是 `状态: 待确认` | 把拆分汇报再给我看一遍，等我确认 |
| `specs/status.md` 里是 `状态: 已确认`，还有 `- [ ]` 的 task | B. 开发（**断点续跑**：已经 `[x]` 的不再做） |
| 所有 task 都是 `[x]` | 告诉我已全部完成，结束 |

---

## A. 拆需求（只写 specs，不写业务代码）

1. **了解项目**：看 `apps/`、`packages/` 的目录结构；读 `packages/db/prisma/schema/` 下所有 `.prisma` 文件、`packages/api/src/routers/index.ts`、`apps/web/src/app/` 下已有的页面
2. **读 PRD**：PDF 或链接先把内容读出来，读不到就停下来告诉我
3. **按功能模块拆分**
   - 一个模块 = 一个能独立验收的功能，例如：用户管理、操作日志
   - 项目里已经有的能力（比如脚手架自带的注册登录）不再重复拆，只拆需要改的部分
   - 模块按依赖顺序编号，被依赖的排前面；文件夹名用英文短横线，例如 `specs/01-user-management/`
4. **每个模块按下面的模板生成** `requirements.md`、`design.md`、`tasks.md`
5. **自查**：PRD 里的每个功能点，都要能在某个 `requirements.md` 里找到对应的验收标准；找不到的记下来
6. **写 `specs/status.md`**：

   ```markdown
   状态: 待确认
   PRD: docs/prd/xxx.md

   | 模块 | task 数 | 依赖 |
   |---|---|---|
   ```

7. **停下来汇报，等我确认**（这一轮到此结束，不要开始写代码）：
   - 模块列表、每个模块的 task 数、模块之间的依赖
   - PRD 里写得不清楚、需要我补充的地方
   - 第 5 步发现的遗漏

**确认之后**：我要改就按我说的改 specs，改完再汇报一次；我说确认了，就把 `specs/status.md` 改成 `状态: 已确认`，提交 specs（`docs(specs): 拆分 xxx 需求`），然后进入 B。

### 模板

#### requirements.md

```markdown
# 模块名

## 背景
一两句话说明为什么要做这个模块。

## 用户故事
- 作为【角色】，我想要【功能】，以便【目的】

## 验收标准
- [ ] AC1：给定……，当……，那么……
- [ ] AC2：……

## 不做的事
- 这次明确不做的内容
```

验收标准必须能在浏览器里手动验证，或者能写成测试；"体验好""性能好"这种不算。

#### design.md

```markdown
# 模块名 · 设计

## 数据库
新增或修改的 Prisma model（写出 schema 片段，写明放在 packages/db/prisma/schema/ 的哪个文件）。

## 接口（tRPC，packages/api/src/routers/）
| procedure | query / mutation | 入参（zod） | 出参 | public / protected / 仅管理员 |
|---|---|---|---|---|

## 页面（apps/web/src/app/）
| 路由 | 作用 | 调用的接口 |
|---|---|---|

## 涉及的文件
- 新建：……
- 修改：……

## 边界情况
- 例如：未登录访问、重复提交、空列表、权限不足、输入超长
```

#### tasks.md

```markdown
# 模块名 · 任务

- [ ] T1 一句话描述 | 依赖: 无 | 文件: packages/db/prisma/schema/xxx.prisma | 串行
- [ ] T2 一句话描述 | 依赖: T1 | 文件: packages/api/src/routers/xxx.ts | 可并行
- [ ] T3 一句话描述 | 依赖: T1 | 文件: apps/web/src/app/xxx/page.tsx | 可并行
- [ ] T4 冒烟测试：按 requirements.md 的验收标准逐条验证 | 依赖: T2, T3 | 串行

## 遗留
<!-- 评审中没修的 P2 记在这里 -->
```

### 拆分规则

- `design.md` 里的路径必须对应项目里真实存在的目录，不能编
- 每个 task 是半小时到一小时的工作量，一次提交就能完成
- 改数据库 schema 的 task 一律标"串行"
- 两个 task 会改同一个文件时，都不能标"可并行"
- 每个模块的最后一个 task 是冒烟测试
- 全部用中文写，代码标识符保持英文

---

## B. 开发（断点续跑）

从第一个还有 `- [ ]` 的模块开始（参数指定了模块就只做那个），一个模块一个模块往下做。

### B1. 开发一个模块

**按需加载**：只读当前模块的 `requirements.md`、`design.md`、`tasks.md`，不要读其他模块的 specs。

把未完成的 task 按依赖分批：

- 依赖都已完成的 task 进入当前批次
- 当前批次里标"可并行"、而且**改的文件互不重叠**的 task，派子代理（Agent 工具）并行做，每个子代理只拿到它那条 task 和本模块的 `design.md`
- 标"串行"的 task（特别是改数据库 schema 的）由你自己按顺序做，不派子代理
- 一批做完再开下一批

每完成一个 task：

1. 改了 Prisma schema → `pnpm db:push`
2. `pnpm check-types` 和 `pnpm check` 都通过（不通过先 `pnpm fix`，再手动修）
3. 在 `tasks.md` 里把这条改成 `- [x]`
4. 立刻 `git commit`，提交信息写 `feat(模块名): T编号 描述`

### B2. 代码评审（每个模块只做一轮）

模块里除冒烟测试外的 task 都完成后：

- 本机有 `codex` 命令（`command -v codex`）→ 执行 `codex review`，评审本模块的提交
- 没有 → 派一个子代理做评审：只看本模块的 diff（`git diff <模块开始前的提交>..HEAD`），对照 `requirements.md` 和 `design.md`，按 P0（会出错、有安全问题）/ P1（逻辑缺陷、边界情况没处理）/ P2（风格、可读性）分级列出问题

**只修 P0 和 P1**，P2 记到本模块 `tasks.md` 的"遗留"一节。修完提交，**不做第二轮评审**。

### B3. 冒烟测试

1. 确认数据库能连上；连不上就停下来告诉我，不要改 `.env` 里的连接串
2. 后台启动 `pnpm dev`（web 3001，server 3000）
3. 按 `requirements.md` 的验收标准逐条验证：页面用浏览器工具操作，接口可以直接请求 `http://localhost:3000/trpc/...`
4. 每条 AC 都在 `requirements.md` 里勾上；没通过的修好再测
5. 全部通过 → 勾上冒烟测试这个 task，提交，停掉 dev 服务

### B4. 收尾

- 还有下一个模块 → 回到 B1
- 全部做完 → 把这次踩过的坑（报错原因、绕过的方法、项目特有的写法）各写一句，追加到 `AGENTS.md` 的"经验"一节，提交
- 最后汇报：完成了哪些模块和 task、评审修了哪些问题、遗留的 P2、需要我人工检查的地方

---

## 全局规则

- 需求不清楚就停下来问我，不要自己猜
- 开发阶段不要修改 requirements 和 design 来迁就实现；确实需要改的，先问我
- 同一个错误修了三次还没解决，就停下来汇报，不要一直重试
- 不 push，不改 `.env`，不装全局依赖
