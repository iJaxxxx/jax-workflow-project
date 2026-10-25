# AI 开发工作流

两段式：先用 `/prd-split` 把需求拆成 specs，人工确认后，再用 `/dev-loop` 按任务清单开发到交付。

命令文件在 `.claude/commands/`，项目规范在 `AGENTS.md`（`CLAUDE.md` 引用它，Claude Code 和 Codex 读的是同一份）。

## 流程图

```
/prd-split <PRD>
│
├─ 1. 读 AGENTS.md、目录结构、现有 Prisma schema、tRPC 路由、页面
├─ 2. specs/ 已有内容？ ──是──→ 问我：追加 / 覆盖
├─ 3. 按功能模块拆分（按依赖编号 01-、02-…）
├─ 4. 每个模块生成 requirements.md / design.md / tasks.md
├─ 5. 自查：PRD 每个功能点都有对应的验收标准
└─ 6. 停下汇报 ──→ 【人工检查：功能有没有漏、拆得合不合理】
                       │
                       ▼
/dev-loop [模块]
│
├─ 0. 读 AGENTS.md → 扫描 specs/
│     ├─ 没有 specs ──→ 提示先跑 /prd-split，结束
│     └─ 有 specs ──→ 找第一个未勾选的 task（断点续跑）
│
├─ 1. 开发一个模块（只加载这个模块的 specs）
│     │  按依赖分批：
│     │  ├─ 可并行 且 文件不重叠 ──→ 派子代理并行
│     │  └─ 串行（含改数据库） ──→ 自己按顺序做
│     │  每个 task：db:push → check-types + check → 勾选 [x] → git commit
│     ▼
├─ 2. 代码评审（一轮）
│     │  有 codex ──→ codex review
│     │  没有 ──→ 子代理按 P0 / P1 / P2 分级评审
│     │  只修 P0、P1，P2 记为遗留 → 提交
│     ▼
├─ 3. 冒烟测试
│     │  pnpm dev → 按 requirements 的验收标准逐条验证
│     │  不通过 ──→ 修复后重测
│     │  通过 ──→ 勾选 → 提交
│     ▼
├─ 4. 还有下一个模块？ ──是──→ 回到 1
│
└─ 5. 全部完成 → 经验写入 AGENTS.md「经验」一节 → 汇报
```

## 设计要点

| 设计 | 为什么 |
|---|---|
| 先建项目再拆 PRD | design 能写出真实的文件路径和表结构，不会脱离技术栈 |
| 拆完停下来人工确认 | AI 拆需求会漏功能，开发前补上成本最低 |
| 输出模板写死 | `/dev-loop` 每次都能按同样的格式读 specs |
| task 标注依赖、文件、串行 / 并行 | 决定哪些能派子代理并行；数据库迁移并行会冲突 |
| 每完成一项就勾选并提交 | 中断后能从断点继续，评审也只看本模块的提交 |
| 按需加载上下文 | 每个阶段只读需要的文档，省 Token，减少跑偏 |
| 评审只做一轮，只修 P0、P1 | 多轮评审慢、费 Token，还容易偏离需求 |
| 经验沉淀到 AGENTS.md | 下一轮开发自动带上，工作流越用越贴合项目 |

## 使用

1. 把 PRD 放到 `docs/prd/`（练习用的示例：`docs/prd/admin.md`）
2. 在项目根目录打开 Claude Code，执行 `/prd-split docs/prd/admin.md`
3. 检查 `specs/` 下生成的内容，有问题直接让它改
4. 执行 `/dev-loop`，中断后再次执行会从未完成的 task 继续
