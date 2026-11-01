# 用户管理 · 任务

基线提交: fbf4162

- [x] T1 User 加 `banned` 字段，Better-Auth 声明 `additionalFields.banned`；`session.create.before` 拦截被禁用用户登录（"账号已被禁用"）；`context.ts` 兜底把被禁用用户的会话视为 `null` | 依赖: 无 | 文件: packages/db/prisma/schema/auth.prisma, packages/auth/src/index.ts, apps/server/src/context.ts | 串行
- [x] T2 `user.list`（分页 20、名字 / 邮箱不区分大小写模糊搜索）和 `user.setBanned`（不能禁用自己、禁用时删除会话），在 routers/index.ts 注册 | 依赖: T1 | 文件: packages/api/src/routers/user.ts, packages/api/src/routers/index.ts | 可并行
- [x] T3 用 shadcn CLI 添加 `alert-dialog`、`table` 组件 | 依赖: 无 | 文件: packages/ui/src/components/alert-dialog.tsx, packages/ui/src/components/table.tsx | 可并行
- [x] T4 tRPC 客户端遇到 `UNAUTHORIZED` 时跳转登录页 | 依赖: 无 | 文件: apps/web/src/utils/trpc.ts | 可并行
- [x] T5 `/dashboard/users` 页面：搜索、表格、分页、禁用 / 启用 + 确认弹窗、空状态 | 依赖: T2, T3 | 文件: apps/web/src/app/dashboard/users/page.tsx, apps/web/src/app/dashboard/users/users-table.tsx | 串行
- [x] R 代码评审：Codex 一轮，修 P0/P1，P2 记到遗留 | 依赖: T4, T5 | 串行
- [x] T6 冒烟测试：按 requirements.md 的验收标准逐条验证 | 依赖: R | 串行

## 遗留
<!-- 评审中没修的 P2 记在这里 -->
- P2 URL 的 `search` 从外部变化（如点导航"用户管理"）时没有同步回输入框，防抖会把旧搜索词写回 URL
- P2 QueryClient 默认重试 3 次，UNAUTHORIZED 约 7 秒后才跳登录页；建议对 UNAUTHORIZED/FORBIDDEN 不重试
- P2 mutation 遇到 UNAUTHORIZED 时，本地 onError 先弹英文 toast 再跳转
- P2 setBanned 幂等分支（已是禁用状态）不删除会话；直接改库或登录与禁用并发时可能残留会话，web 端 getSession 仍视为登录
- P2 列表查询出错时表格区域空白，没有错误状态和重试按钮
- P2 确认弹窗关闭动画期间文案闪变（pending 置空过早）
