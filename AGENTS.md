# 项目说明

## 技术栈与目录

Better-T-Stack 生成的 pnpm + Turborepo monorepo。

| 位置 | 作用 |
|---|---|
| `apps/web` | Next.js 前端，端口 3001。页面在 `src/app/`，组件在 `src/components/`，tRPC 客户端在 `src/utils/trpc.ts` |
| `apps/server` | Hono 后端，端口 3000。挂载 `/api/auth/*`（Better-Auth）和 `/trpc/*` |
| `packages/api` | tRPC。`src/index.ts` 定义 `publicProcedure` / `protectedProcedure`，路由写在 `src/routers/` |
| `packages/db` | Prisma + PostgreSQL。schema 在 `prisma/schema/`（`auth.prisma` 是认证表，业务表写在 `schema.prisma` 或新建文件） |
| `packages/auth` | Better-Auth 配置 |
| `packages/ui` | 共享 UI 组件（shadcn） |
| `apps/fumadocs` | 文档站 |

## 约定

- 新接口一律写成 tRPC procedure，放在 `packages/api/src/routers/`，在 `routers/index.ts` 注册；不要在 Hono 里直接加业务路由
- 需要登录的接口用 `protectedProcedure`
- 改了 Prisma schema 后执行 `pnpm db:push`
- 环境变量在各包的 `.env`，字段定义见 `.env.schema`；不要把 `.env` 提交到 Git
- 提交前 `pnpm check-types` 和 `pnpm check` 必须通过（Claude Code 里由 commit hook 强制）
- 代码风格（Ultracite / Biome 规则）见 `docs/code-standards.md`，写代码拿不准时再看
- Next.js 版本较新，写前端前先看 `apps/web/AGENTS.md`
- Skills 和 MCP 只装在项目里（`.agents/skills`、`.mcp.json`），不装全局

## 常用命令

- `pnpm dev`：同时启动 web 和 server
- `pnpm db:push` / `pnpm db:studio`：同步表结构 / 打开数据库面板
- `pnpm check` / `pnpm fix`：检查 / 自动修复代码风格
- `pnpm check-types`：类型检查
- `scripts/dev.sh up|down`：检查数据库后后台启动 / 停止 dev 服务
- `scripts/acceptance.sh <模块>`：跑模块的 e2e 验收（`e2e/<模块>.spec.ts`），结果回写 AC 勾选

## 开发工作流

需求开发统一走 `/jax-workflow [PRD 或模块名]`，流程见 `docs/workflow.md`。入口先判断 `specs/` 的状态：

- specs 不存在或不完整 → 读 `docs/prd/` 下的 PRD，拆成 `specs/NN-模块/{requirements,design,tasks}.md`，写 `specs/status.md`。默认直接写 `状态: 已确认` 并继续开发；参数带 `--confirm` 或说明需要人工检查时，写 `状态: 待确认` 后停下来等人工确认
- `specs/status.md` 是 `状态: 已确认` → 从第一个未勾选的 task 断点续跑：开发 → 一轮评审（task `R`）→ e2e 验收 → 提交

代码评审只用 Codex：`scripts/codex-review.sh <模块起点>`（调用 Codex CLI，用本机已登录的 ChatGPT 账号，说明见 `docs/workflow.md`）。Codex 不可用时停下来报告，不用 Claude 子代理代替。拆完需求后用 `scripts/codex-spec-review.sh <PRD>` 让 Codex 审一次 specs。

## 测试账号

- （本地注册后填在这里，例如 `admin@test.local`）

## 经验

<!-- /jax-workflow 每轮结束后把踩过的坑追加在这里 -->
