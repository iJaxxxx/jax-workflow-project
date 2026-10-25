---
description: 按 specs/*/tasks.md 逐条开发 → 评审 → 冒烟测试 → 提交，支持断点续跑
argument-hint: <可选：只做某个模块，例如 01-user-management>
---

你是这个项目的开发负责人。按 `specs/` 里的任务清单把需求做完。完整流程图见 `docs/workflow.md`。

范围：$ARGUMENTS（为空表示所有模块，按编号顺序做）

## 0. 准备

1. 读 `AGENTS.md`（只读一次，后面不重复读）
2. 扫描 `specs/`：
   - 没有任何模块 → 告诉我先执行 `/prd-split`，然后结束
   - 有模块 → 找到第一个还有 `- [ ]` 的模块，从它的第一个未勾选 task 开始（**断点续跑**：已经 `[x]` 的不再做）
3. `git status` 有未提交的改动时，先问我怎么处理，不要覆盖

## 1. 开发一个模块

**按需加载**：只读当前模块的 `requirements.md`、`design.md`、`tasks.md`，不要读其他模块的 specs。

把未完成的 task 按依赖分批：

- 依赖都已完成的 task 进入当前批次
- 当前批次里标"可并行"、而且**改的文件互不重叠**的 task，派子代理（Agent 工具）并行做，每个子代理只拿到它那条 task 和本模块的 design.md
- 标"串行"的 task（特别是改数据库 schema 的）由你自己按顺序做，不派子代理
- 一批做完再开下一批

每完成一个 task：

1. 改了 Prisma schema → `pnpm db:push`
2. `pnpm check-types` 和 `pnpm check` 都通过（不通过先 `pnpm fix`，再手动修）
3. 在 `tasks.md` 里把这条改成 `- [x]`
4. 立刻 `git commit`，提交信息写 `feat(模块名): T编号 描述`

## 2. 代码评审（每个模块只做一轮）

模块里除冒烟测试外的 task 都完成后：

- 本机有 `codex` 命令（`command -v codex`）→ 执行 `codex review`，评审本模块的提交
- 没有 → 派一个子代理做评审：只看本模块的 diff（`git diff <模块开始前的提交>..HEAD`），对照 `requirements.md` 和 `design.md`，按 P0（会出错、有安全问题）/ P1（逻辑缺陷、边界情况没处理）/ P2（风格、可读性）分级列出问题

**只修 P0 和 P1**，P2 记到本模块 `tasks.md` 末尾的"遗留"一节。修完提交，**不做第二轮评审**。

## 3. 冒烟测试

1. 确认数据库能连上；连不上就停下来告诉我，不要改 `.env` 里的连接串
2. 后台启动 `pnpm dev`（web 3001，server 3000）
3. 按 `requirements.md` 的验收标准逐条验证：页面用浏览器工具操作，接口可以直接请求 `http://localhost:3000/trpc/...`
4. 每条 AC 都在 `requirements.md` 里勾上；没通过的修好再测
5. 全部通过 → 勾上冒烟测试这个 task，提交，停掉 dev 服务

## 4. 收尾

- 还有下一个模块 → 回到第 1 步
- 全部做完 → 把这次踩过的坑（报错原因、绕过的方法、项目特有的写法）各写一句，追加到 `AGENTS.md` 的"经验"一节，提交
- 最后汇报：完成了哪些模块和 task、评审修了哪些问题、遗留的 P2、需要我人工检查的地方

## 规则

- 需求不清楚就停下来问我，不要自己猜
- 不要修改 `specs/` 里的 requirements 和 design 来迁就实现；确实需要改的，先问我
- 同一个错误修了三次还没解决，就停下来汇报，不要一直重试
- 不 push，不改 `.env`，不装全局依赖
