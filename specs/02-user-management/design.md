# 用户管理 · 设计

## 数据库
修改 `packages/db/prisma/schema/auth.prisma` 中的 `User`：

```prisma
model User {
  // ...已有字段
  banned        Boolean   @default(false)
}
```

`packages/auth/src/index.ts` 的 `user.additionalFields` 增加：

```ts
banned: { type: "boolean", required: false, defaultValue: false, input: false },
```

## 登录拦截（packages/auth/src/index.ts）
- `databaseHooks.session.create.before`：根据 `session.userId` 查用户，`banned === true` 时 `throw new APIError("FORBIDDEN", { message: "账号已被禁用" })`（`APIError` 从 `better-auth/api` 导入）。登录表单已有的 `toast.error(error.error.message)` 会把这句话显示出来
- 已登录用户被禁用：`user.setBanned` 在同一个事务里删除该用户的所有 `Session`，下一次请求时 `get-session` 返回 `null`
- 兜底：`apps/server/src/context.ts` 里如果 `session.user.banned` 为 `true`，把 `session` 当作 `null`

## 接口（tRPC，packages/api/src/routers/user.ts，在 routers/index.ts 注册为 `user`）
| procedure | query / mutation | 入参（zod） | 出参 | 权限 |
|---|---|---|---|---|
| `user.list` | query | `{ page: z.number().int().min(1).default(1), search: z.string().trim().max(100).optional() }` | `{ items: { id, name, email, role, banned, createdAt }[], total: number, page: number, pageSize: 20 }` | 仅管理员 |
| `user.setBanned` | mutation | `{ userId: z.string().min(1), banned: z.boolean() }` | `{ id, banned }` | 仅管理员 |

- `user.list`：`search` 非空时 `where: { OR: [{ name: { contains, mode: "insensitive" } }, { email: { contains, mode: "insensitive" } }] }`；`orderBy: { createdAt: "desc" }`；`skip = (page - 1) * 20`；`count` 和 `findMany` 用 `$transaction` 一起查
- `user.setBanned`：
  - `userId === ctx.session.user.id` → `FORBIDDEN`（"不能禁用自己"）
  - 目标是其他管理员 → 允许（只限制不能禁用自己）
  - 用户不存在 → `NOT_FOUND`
  - 状态已经是目标值 → 直接返回，不报错
  - 否则 `$transaction`：更新 `banned`；`banned === true` 时 `session.deleteMany({ where: { userId } })`
  - 为模块 03 留好位置：事务写成 `ctx.db.$transaction(async (tx) => { ... })` 的交互式写法

## 页面（apps/web/src/app/）
| 路由 | 作用 | 调用的接口 |
|---|---|---|
| `/dashboard/users`（`dashboard/users/page.tsx` + `dashboard/users/users-table.tsx`） | 搜索框（回车或防抖 300ms 后更新 URL 的 `search`、重置 `page=1`）、用户表格、分页、禁用 / 启用按钮 + 确认弹窗、空状态。`page` / `search` 存在 URL 查询参数里 | `user.list`、`user.setBanned` |

- 列表组件是客户端组件，用 `useTRPC()` + `useQuery` / `useMutation`；mutation 成功后 `invalidateQueries` 刷新 `user.list`，并 `toast.success`
- 状态显示"正常" / "已禁用"，角色显示"管理员" / "普通用户"，注册时间格式 `YYYY-MM-DD HH:mm`
- 自己那一行（`id === session.user.id`）的禁用按钮 `disabled`

## 共享组件（packages/ui/src/components/）
脚手架里没有表格和确认弹窗，用 shadcn CLI 添加（`components.json` 风格为 `base-lyra`）：
- 新建：`alert-dialog.tsx`（确认弹窗；不能用 `window.confirm`，Biome 的 `noAlert` 会报错）、`table.tsx`
- `empty.tsx` 已存在，空状态直接用

## 全局：被退出后的处理（apps/web/src/utils/trpc.ts）
`QueryCache` / `MutationCache` 的 `onError` 里，错误码是 `UNAUTHORIZED` 时 `window.location.href = "/login?redirect=" + 当前路径`，不再弹"retry" toast

## 涉及的文件
- 新建：`packages/api/src/routers/user.ts`、`apps/web/src/app/dashboard/users/page.tsx`、`apps/web/src/app/dashboard/users/users-table.tsx`、`packages/ui/src/components/alert-dialog.tsx`、`packages/ui/src/components/table.tsx`
- 修改：`packages/db/prisma/schema/auth.prisma`、`packages/auth/src/index.ts`、`apps/server/src/context.ts`、`packages/api/src/routers/index.ts`、`apps/web/src/utils/trpc.ts`

## 边界情况
- 未登录 / 普通用户调用接口：`adminProcedure` 返回 `UNAUTHORIZED` / `FORBIDDEN`
- 禁用自己：前端按钮禁用 + 后端 `FORBIDDEN`
- 重复点击确认：确认按钮在 mutation `isPending` 时禁用
- 重复禁用已禁用用户：幂等，不报错
- `page` 超出总页数（例如手改 URL）：返回空 `items`，页面显示空状态并提供"回到第 1 页"
- `page` 不是正整数：前端解析失败时按 1 处理
- 搜索词前后空格：`trim()`；超过 100 字符：zod 拒绝
- 搜索词里的 `%`、`_`：Prisma `contains` 会转义，按字面匹配
- 被禁用用户正在后台页面上：下一次 tRPC 请求返回 `UNAUTHORIZED` → 跳登录
