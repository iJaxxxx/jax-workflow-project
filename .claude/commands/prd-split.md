---
description: 读 PRD，按功能模块拆成 specs/（requirements / design / tasks）
argument-hint: <PRD 文件路径或链接，默认读 docs/prd/ 下最新的文件>
---

你是这个项目的技术负责人。把 PRD 拆成可以直接开发的 specs，交给 `/dev-loop` 执行。**这个命令只写 specs，不写业务代码。**

## 输入

PRD：$ARGUMENTS

- 没给参数：读 `docs/prd/` 下修改时间最新的文件
- PDF 或链接：先把内容读出来；读不到就停下来告诉我

## 步骤

1. **了解项目**：读 `AGENTS.md`；看 `apps/`、`packages/` 的目录结构；读 `packages/db/prisma/schema/` 下的所有 `.prisma` 文件，了解现有的表；读 `packages/api/src/routers/index.ts` 和 `apps/web/src/app/` 下已有的页面
2. **检查已有 specs**：如果 `specs/` 下已经有模块，列出来，问我要"追加新模块"还是"覆盖"，得到答复前不要动现有文件
3. **读 PRD，按功能模块拆分**
   - 一个模块 = 一个能独立验收的功能，例如：用户管理、操作日志
   - 项目里已经有的能力（比如脚手架自带的注册登录）不再重复拆，只拆需要改的部分
   - 模块按依赖顺序编号：`01-`、`02-`……，被依赖的排前面；文件夹名用英文短横线，例如 `specs/01-user-management/`
4. **每个模块按下面的模板生成三个文件**
5. **自查**：PRD 里的每个功能点，都要能在某个 `requirements.md` 里找到对应的验收标准；找不到的记下来
6. **停下来汇报，等我确认**（不要开始写代码）：
   - 模块列表、每个模块的 task 数
   - 模块之间的依赖关系
   - PRD 里写得不清楚、需要我补充的地方
   - 第 5 步发现的遗漏

## 模板

### requirements.md

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

### design.md

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

### tasks.md

```markdown
# 模块名 · 任务

- [ ] T1 一句话描述 | 依赖: 无 | 文件: packages/db/prisma/schema/xxx.prisma | 串行
- [ ] T2 一句话描述 | 依赖: T1 | 文件: packages/api/src/routers/xxx.ts | 可并行
- [ ] T3 一句话描述 | 依赖: T1 | 文件: apps/web/src/app/xxx/page.tsx | 可并行
- [ ] T4 冒烟测试：按 requirements.md 的验收标准逐条验证 | 依赖: T2, T3 | 串行
```

## 规则

- `design.md` 里的路径必须对应项目里真实存在的目录，不能编
- 每个 task 是半小时到一小时的工作量，一次提交就能完成
- 改数据库 schema 的 task 一律标"串行"
- 两个 task 会改同一个文件时，都不能标"可并行"
- 每个模块的最后一个 task 是冒烟测试
- 全部用中文写，代码标识符保持英文
