# 操作日志 · 设计

## 数据库
新建 `packages/db/prisma/schema/operation-log.prisma`：

```prisma
enum OperationAction {
  USER_BAN
  USER_UNBAN
}

model OperationLog {
  id         String          @id @default(cuid())
  action     OperationAction
  operatorId String
  operator   User            @relation("OperationLogOperator", fields: [operatorId], references: [id], onDelete: Restrict)
  targetId   String
  target     User            @relation("OperationLogTarget", fields: [targetId], references: [id], onDelete: Restrict)
  createdAt  DateTime        @default(now())

  @@index([createdAt])
  @@index([action, createdAt])
  @@map("operation_log")
}
```

同时修改 `packages/db/prisma/schema/auth.prisma` 的 `User`，加反向关系：

```prisma
  operationLogsAsOperator OperationLog[] @relation("OperationLogOperator")
  operationLogsAsTarget   OperationLog[] @relation("OperationLogTarget")
```

`onDelete: Restrict`：日志不能被删，用户被删时不能连带删日志（本期没有删除用户功能，这里只是兜底）。

## 接口（tRPC，packages/api/src/routers/）
| procedure | query / mutation | 入参（zod） | 出参 | 权限 |
|---|---|---|---|---|
| `operationLog.list`（新建 `operation-log.ts`，在 `index.ts` 注册） | query | `{ page: z.number().int().min(1).default(1), action: z.enum(["USER_BAN", "USER_UNBAN"]).optional() }` | `{ items: { id, action, createdAt, operator: { id, name, email }, target: { id, name, email } }[], total, page, pageSize: 20 }` | 仅管理员 |

修改 `user.ts` 的 `user.setBanned`：在已有的 `$transaction(async (tx) => …)` 里，状态确实发生变化时 `tx.operationLog.create({ data: { action, operatorId: ctx.session.user.id, targetId: userId } })`。更新用户和写日志在同一个事务里，要么都成功，要么都失败。

**只有 `list`，不提供 create / update / delete procedure。**

## 页面（apps/web/src/app/）
| 路由 | 作用 | 调用的接口 |
|---|---|---|
| `/dashboard/logs`（`dashboard/logs/page.tsx` + `dashboard/logs/logs-table.tsx`） | 操作类型筛选（全部 / 禁用用户 / 启用用户）、日志表格（操作时间、操作人、操作类型、操作对象）、分页、空状态。`page` / `action` 存在 URL 查询参数里 | `operationLog.list` |

- 操作类型显示：`USER_BAN` → "禁用用户"，`USER_UNBAN` → "启用用户"
- 操作人、操作对象显示"名字（邮箱）"
- 时间格式 `YYYY-MM-DD HH:mm:ss`
- 筛选控件用原生 `<select>` 或 `packages/ui` 已有组件；表格复用模块 02 添加的 `table.tsx`

## 涉及的文件
- 新建：`packages/db/prisma/schema/operation-log.prisma`、`packages/api/src/routers/operation-log.ts`、`apps/web/src/app/dashboard/logs/page.tsx`、`apps/web/src/app/dashboard/logs/logs-table.tsx`
- 修改：`packages/db/prisma/schema/auth.prisma`、`packages/api/src/routers/user.ts`、`packages/api/src/routers/index.ts`

## 边界情况
- 禁用自己被拒、用户不存在、状态没变：不写日志
- 写日志失败：整个事务回滚，用户状态也不变
- 空列表 / 筛选无结果：空状态
- `page` 超出范围：空 `items`，显示空状态
- URL 里 `action` 是非法值：前端忽略，按"全部"处理
- 普通用户 / 未登录：`adminProcedure` 拦截
