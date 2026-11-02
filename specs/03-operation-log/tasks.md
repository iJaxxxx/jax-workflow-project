# 操作日志 · 任务

基线提交: 861d17c

- [x] T1 新建 `OperationLog` model 和 `OperationAction` 枚举，User 加反向关系 | 依赖: 无 | 文件: packages/db/prisma/schema/operation-log.prisma, packages/db/prisma/schema/auth.prisma | 串行
- [x] T2 `user.setBanned` 在事务里写操作日志 | 依赖: T1 | 文件: packages/api/src/routers/user.ts | 串行
- [x] T3 `operationLog.list`（分页 20、按操作类型筛选、时间倒序），在 routers/index.ts 注册 | 依赖: T1 | 文件: packages/api/src/routers/operation-log.ts, packages/api/src/routers/index.ts | 可并行
- [x] T4 `/dashboard/logs` 页面：筛选、表格、分页、空状态 | 依赖: T3 | 文件: apps/web/src/app/dashboard/logs/page.tsx, apps/web/src/app/dashboard/logs/logs-table.tsx | 串行
- [ ] R 代码评审：Codex 一轮，修 P0/P1，P2 记到遗留 | 依赖: T2, T4 | 层: 评审
- [ ] TA 后端测试：e2e/03-operation-log.api.spec.ts 覆盖所有"验证: api"的 AC | 依赖: T2, T3 | 层: 后端测试
- [ ] TU 前端测试：e2e/03-operation-log.ui.spec.ts 覆盖所有"验证: ui"的 AC | 依赖: T4 | 层: 前端测试
- [ ] TZ 总测试：check-types、check、scripts/acceptance.sh 03-operation-log 全部通过 | 依赖: R, TA, TU | 层: 总测试

## 遗留
<!-- 评审中没修的 P2 记在这里 -->
