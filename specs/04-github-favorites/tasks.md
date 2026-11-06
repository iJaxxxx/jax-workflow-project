# GitHub 用户收藏（Web） · 任务

基线提交: 190a5f0

- [x] T1 新建共享包 `@jax-workflow-project/github-users`：zod schema、`parseGithubProfile` / `parseFavoriteUser`、`GithubUsersApiError`、`createGithubUsersClient` 的签名（方法先抛 NOT_IMPLEMENTED）；web 加包依赖 | 依赖: 无 | 文件: packages/github-users/package.json, packages/github-users/tsconfig.json, packages/github-users/src/schema.ts, packages/github-users/src/client.ts, apps/web/package.json, pnpm-lock.yaml | 层: 契约
- [x] T2 实现共享客户端和解析：请求 AWS、`search` 先校验用户名、35 秒超时、snake_case 转 camelCase、`github_id` 转数字、非 2xx 抛 `GithubUsersApiError` | 依赖: T1 | 文件: packages/github-users/src/client.ts, packages/github-users/src/schema.ts | 层: 后端
- [ ] T3 `/github` 页面骨架、react-query hooks 和查询区：输入框、"查询"按钮、结果卡片、"添加" / "已添加"、错误提示；头部导航加入口 | 依赖: T1 | 文件: apps/web/src/app/github/use-favorites.ts, apps/web/src/app/github/page.tsx, apps/web/src/app/github/search-panel.tsx, apps/web/src/components/header.tsx | 层: 前端
- [ ] T4 收藏列表：列表展示、编辑备注、删除确认、空状态、加载和错误状态，并挂到 `/github` 页面查询区下方 | 依赖: T3 | 文件: apps/web/src/app/github/favorite-list.tsx, apps/web/src/app/github/page.tsx | 层: 前端
- [ ] R 代码评审：Codex 一轮，修 P0/P1，P2 记到遗留 | 依赖: T2, T4 | 层: 评审
- [ ] TA 后端测试：e2e/04-github-favorites.api.spec.ts 覆盖所有"验证: api"的 AC | 依赖: T2 | 层: 后端测试
- [ ] TU 前端测试：e2e/04-github-favorites.ui.spec.ts 覆盖所有"验证: ui"的 AC | 依赖: T2, T3, T4 | 层: 前端测试
- [ ] TZ 总测试：check-types、check、scripts/acceptance.sh 04-github-favorites 全部通过 | 依赖: R, TA, TU | 层: 总测试

## 遗留
<!-- 评审中没修的 P2 记在这里 -->
