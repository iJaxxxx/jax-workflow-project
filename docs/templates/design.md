# 模块名 · 设计

## 数据库
新增或修改的 Prisma model（写出 schema 片段，写明放在 packages/db/prisma/schema/ 的哪个文件）。

## 接口（tRPC，packages/api/src/routers/）
| procedure | query / mutation | 入参（zod） | 出参（zod，契约里写成 `.output()`） | public / protected / 仅管理员 |
|---|---|---|---|---|

## 页面（apps/web/src/app/）
| 路由 | 作用 | 调用的接口 |
|---|---|---|

## 涉及的文件
- 新建：……
- 修改：……

## 边界情况
写成"情况 → 期望行为"，不写实现方式：
- 例如：未登录访问 → 跳登录页；重复提交 → 只生效一次；输入超长 → 提示并拒绝
