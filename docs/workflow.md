# AI 开发工作流

只有一个入口命令 `/jax-workflow`。它先判断 `specs/` 是否完整：不完整就拆 PRD，默认拆完直接开发（参数带 `--confirm` 或说明需要人工检查时，才停下来等人工确认）；完整就从断点继续开发，一直做到交付。

命令文件在 `.claude/commands/jax-workflow.md`，项目规范在 `AGENTS.md`（`CLAUDE.md` 引用它，Claude Code 和 Codex 读的是同一份）。

## 流程图

GitHub、VS Code（装 Markdown Preview Mermaid Support 插件）和飞书文档都能直接渲染下面这张图。

```mermaid
flowchart TD
    Start(["/jax-workflow [PRD 或模块名]"]) --> Init["读 AGENTS.md<br/>检查 git status"]
    Init --> Check{"codex-review.sh --check<br/>Codex 可用？"}
    Check -->|"不可用"| Stop(["报告原因，结束"])
    Check -->|"可用"| Judge{"specs 状态？"}

    Judge -->|"给了新 PRD / specs 不存在 / 有模块缺文件"| A1
    Judge -->|"status.md = 待确认<br/>（人工检查模式）"| A6
    Judge -->|"status.md = 已确认<br/>还有未勾选的 task"| B1
    Judge -->|"所有 task 已完成"| Done(["结束"])

    subgraph A["A. 拆需求（只写 specs，不写代码）"]
        A1["A1 读目录结构、Prisma schema、<br/>tRPC 路由、现有页面"] --> A2["A2 读 PRD，按功能模块拆分<br/>按依赖编号 01-、02-…"]
        A2 --> A3["A3 每个模块生成<br/>requirements / design / tasks"]
        A3 --> A4["A4 自查：每个功能点<br/>都有验收标准"]
        A4 --> A5["A5 写 specs/status.md<br/>自动: 已确认 / 人工: 待确认"]
        A5 --> A6["A6 汇报拆分结果"]
    end

    A6 --> Mode{"要求人工检查？<br/>--confirm 或文字说明"}
    Mode -->|"否（默认）"| Auto["提交 specs"] --> B1
    Mode -->|"是"| Human{"人工检查<br/>功能有没有漏？"}
    Human -->|"要改"| Fix["按意见改 specs"] --> A6
    Human -->|"确认"| Confirm["status.md 改为已确认<br/>提交 specs"] --> B1

    subgraph B["B. 开发（从第一个未勾选的 task 断点续跑）"]
        B1["B1 只加载当前模块的 specs<br/>按依赖分批"] --> Split{"task 类型"}
        Split -->|"可并行且文件不重叠"| Para["派子代理并行开发"]
        Split -->|"串行（含改数据库）"| Seq["自己按顺序开发"]
        Para --> Each["每个 task：db:push → check-types + check<br/>→ 勾选 [x] → git commit"]
        Seq --> Each
        Each --> More{"本模块还有<br/>未完成的开发 task？"}
        More -->|"是"| B1
        More -->|"否"| B2

        B2["B2 Codex 评审<br/>scripts/codex-review.sh 模块起点"] --> Ok{"评审成功？"}
        Ok -->|"失败"| Wait(["停下，报告原因<br/>处理好后从 B2 继续"])
        Ok -->|"成功"| FixP["Claude 只修 P0、P1<br/>P2 记为遗留 → 提交<br/>（修完不再评审）"]

        FixP --> B3["B3 冒烟测试<br/>pnpm dev，按验收标准逐条验证"]
        B3 --> Pass{"全部通过？"}
        Pass -->|"否"| Repair["修复"] --> B3
        Pass -->|"是"| Commit["勾选冒烟测试 → 提交"]
        Commit --> Next{"还有下一个模块？"}
        Next -->|"是"| B1
    end

    Next -->|"否"| B4["B4 经验写入 AGENTS.md「经验」<br/>汇报完成情况和遗留问题"]
    B4 --> Done
```

### 文字版

```
/jax-workflow [PRD 或模块名] [--confirm]
│
├─ 0. 入口：读 AGENTS.md → 检查 git status → 检查 Codex 可用（不可用就结束）→ 判断 specs 状态
│     │
│     ├─ 给了新的 PRD ／ specs 不存在 ／ 有模块缺文件 ──→ A. 拆需求
│     ├─ status.md = 待确认（人工检查模式）──→ 重新汇报，等确认
│     ├─ status.md = 已确认，还有未勾选的 task ──→ B. 开发（断点续跑）
│     └─ 所有 task 已完成 ──→ 结束
│
├─ A. 拆需求（只写 specs，不写代码）
│     ├─ A1. 读目录结构、现有 Prisma schema、tRPC 路由、页面
│     ├─ A2. 读 PRD，按功能模块拆分（按依赖编号 01-、02-…）
│     ├─ A3. 每个模块生成 requirements.md / design.md / tasks.md
│     ├─ A4. 自查：PRD 每个功能点都有对应的验收标准
│     ├─ A5. 写 specs/status.md（自动模式: 已确认；人工检查模式: 待确认）
│     └─ A6. 汇报拆分结果
│           │
│           ├─ 默认（自动模式）──→ 提交 specs → 直接进入 B
│           └─ 带 --confirm / 说明要人工检查 ──→ 停下 【人工检查：功能有没有漏、拆得合不合理】
│                 │
│                 ├─ 要改 ──→ 改 specs → 再汇报
│                 └─ 确认 ──→ status.md 改为"已确认" → 提交 specs → 进入 B
│
└─ B. 开发（从第一个未勾选的 task 开始）
      │
      ├─ B1. 开发一个模块（只加载这个模块的 specs）
      │     │  按依赖分批：
      │     │  ├─ 可并行 且 文件不重叠 ──→ 派子代理并行
      │     │  └─ 串行（含改数据库） ──→ 自己按顺序做
      │     │  每个 task：db:push → check-types + check → 勾选 [x] → git commit
      │     ▼
      ├─ B2. 代码评审（一轮）
      │     │  scripts/codex-review.sh <模块起点>（Codex CLI + ChatGPT 账号）
      │     │  失败 ──→ 停下报告，处理好再继续（不用子代理代替）
      │     │  Claude 只修 P0、P1，P2 记为遗留 → 提交（修完不再调 Codex 复查）
      │     ▼
      ├─ B3. 冒烟测试
      │     │  pnpm dev → 按 requirements 的验收标准逐条验证
      │     │  不通过 ──→ 修复后重测
      │     │  通过 ──→ 勾选 → 提交
      │     ▼
      ├─ 还有下一个模块？ ──是──→ 回到 B1
      │
      └─ B4. 全部完成 → 经验写入 AGENTS.md「经验」一节 → 汇报
```

## 设计要点

| 设计 | 为什么 |
|---|---|
| 一个入口，按 specs 状态分支 | 不用记该跑哪个命令；中断后再执行同一个命令就能接着做 |
| 先建项目再拆 PRD | design 能写出真实的文件路径和表结构，不会脱离技术栈 |
| 默认拆完直接开发，需要时用 `--confirm` 停下来人工确认，状态记在 `specs/status.md` | 小需求一条命令跑到底；重要需求开发前人工补漏成本最低。状态写在文件里，换个会话也知道确认过没有 |
| 输出模板写死 | 开发阶段每次都能按同样的格式读 specs |
| task 标注依赖、文件、串行 / 并行 | 决定哪些能派子代理并行；数据库迁移并行会冲突 |
| 每完成一项就勾选并提交 | 中断后能从断点继续，评审也只看本模块的提交 |
| 按需加载上下文 | 每个阶段只读需要的文档，省 Token，减少跑偏 |
| 评审只用 Codex，不可用就停下，不用 Claude 子代理代替 | 写代码和评审用不同模型，评审才有第二视角 |
| 评审只做一轮，Claude 修完 P0、P1 后不再让 Codex 复查 | 多轮评审慢、费 Token，还容易偏离需求 |
| 经验沉淀到 AGENTS.md | 下一轮开发自动带上，工作流越用越贴合项目 |

## 准备：Codex 评审

代码评审由 `scripts/codex-review.sh` 调用 Codex CLI 的 `codex review --base <模块起点>`，用本机 Codex 登录的 ChatGPT 账号，会消耗 Codex 额度。

脚本按这个顺序找 codex：环境变量 `CODEX_BIN` → PATH 里的 `codex` → Codex 桌面版自带的 CLI（`~/.codex/plugins/.plugin-appserver/codex-cli/bin/codex`）。装了 Codex 桌面版并登录过 ChatGPT 账号就能直接用，不需要再装插件。

模型默认 `gpt-6-luna`，可以用环境变量 `CODEX_MODEL` 换。脚本不读 `~/.codex/config.toml` 里的 `model`，因为那里的模型 ChatGPT 账号不一定能用（例如 `gpt-6-astra` 会报 `model_not_found`）。

`codex review --base` 评审的是模块起点到当前工作区的全部改动，包括没提交的文件，所以要在本模块的提交都做完、工作区干净时再跑。

检查是否可用：

```bash
scripts/codex-review.sh --check
```

不可用时：
- 没找到 codex：装 Codex 桌面版，或 `npm install -g @openai/codex`
- 没登录：在终端执行 `codex login`（或脚本提示的完整路径），用 ChatGPT 账号登录

Codex 不可用时 `/jax-workflow` 会在入口直接结束，不会用子代理代替评审。

## 使用

1. 把 PRD 放到 `docs/prd/`（练习用的示例：`docs/prd/admin.md`）
2. 在项目根目录打开 Claude Code，执行 `/jax-workflow docs/prd/admin.md`，拆完需求会直接开发
3. 想先检查拆分结果再开发，执行 `/jax-workflow docs/prd/admin.md --confirm`：检查 `specs/` 下生成的内容，有问题直接让它改；没问题就回复"确认"，它再接着开发
4. 中断后再次执行 `/jax-workflow`，会从未完成的 task 继续
