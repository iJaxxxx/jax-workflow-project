# 操作日志 · 任务

- [ ] T1 新建 `OperationLog` model 和 `OperationAction` 枚举，User 加反向关系 | 依赖: 无 | 文件: packages/db/prisma/schema/operation-log.prisma, packages/db/prisma/schema/auth.prisma | 串行
- [ ] T2 `user.setBanned` 在事务里写操作日志 | 依赖: T1 | 文件: packages/api/src/routers/user.ts | 串行
- [ ] T3 `operationLog.list`（分页 20、按操作类型筛选、时间倒序），在 routers/index.ts 注册 | 依赖: T1 | 文件: packages/api/src/routers/operation-log.ts, packages/api/src/routers/index.ts | 可并行
- [ ] T4 `/dashboard/logs` 页面：筛选、表格、分页、空状态 | 依赖: T3 | 文件: apps/web/src/app/dashboard/logs/page.tsx, apps/web/src/app/dashboard/logs/logs-table.tsx | 串行
- [ ] T5 冒烟测试：按 requirements.md 的验收标准逐条验证 | 依赖: T2, T4 | 串行

## 遗留
<!-- 评审中没修的 P2 记在这里 -->
