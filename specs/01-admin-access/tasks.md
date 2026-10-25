# 后台访问控制 · 任务

- [x] T1 User 加 `role` 字段，Better-Auth 声明 `additionalFields.role`（`input: false`），客户端 `auth-client.ts` 推断附加字段 | 依赖: 无 | 文件: packages/db/prisma/schema/auth.prisma, packages/auth/src/index.ts, apps/web/src/lib/auth-client.ts | 串行
- [ ] T2 新增 `adminProcedure` | 依赖: T1 | 文件: packages/api/src/index.ts | 可并行
- [ ] T3 登录 / 注册成功后回跳 `redirect` 参数，新增 `safeRedirect` | 依赖: 无 | 文件: apps/web/src/lib/safe-redirect.ts, apps/web/src/app/login/page.tsx, apps/web/src/components/sign-in-form.tsx, apps/web/src/components/sign-up-form.tsx | 可并行
- [ ] T4 新增 `proxy.ts`，未登录访问 `/dashboard/*` 跳 `/login?redirect=…` | 依赖: 无 | 文件: apps/web/src/proxy.ts | 可并行
- [ ] T5 后台 layout：角色校验、"无权限访问"、管理员头部（名字 / 邮箱 / 导航 / 退出），改写 dashboard 首页并删除脚手架示例 | 依赖: T1 | 文件: apps/web/src/app/dashboard/layout.tsx, apps/web/src/app/dashboard/page.tsx, apps/web/src/app/dashboard/dashboard.tsx, apps/web/src/components/admin-header.tsx, apps/web/src/components/forbidden.tsx | 可并行
- [ ] T6 冒烟测试：按 requirements.md 的验收标准逐条验证 | 依赖: T2, T3, T4, T5 | 串行

## 遗留
<!-- 评审中没修的 P2 记在这里 -->
