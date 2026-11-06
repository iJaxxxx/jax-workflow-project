# GitHub 用户收藏（Android / iOS） · 任务

基线提交: f21d8ce

- [x] T1 在 `apps/native` 创建 Expo + TypeScript 应用骨架：`start` / `check-types` / `export:ios` / `export:android` 脚本，Metro 按 monorepo 配置能解析 workspace 包，依赖共享包 `@jax-workflow-project/github-users` | 依赖: 无 | 文件: apps/native/package.json, apps/native/app.json, apps/native/tsconfig.json, apps/native/metro.config.js, apps/native/index.ts, apps/native/App.tsx, apps/native/.gitignore, pnpm-lock.yaml | 层: 前端
- [x] T2 数据层：共享客户端实例和 react-query hooks（查询、列表、添加、修改备注、删除，写操作成功后刷新列表），App 根部挂 QueryClientProvider | 依赖: T1 | 文件: apps/native/src/api.ts, apps/native/App.tsx | 层: 前端
- [x] T3 收藏页和查询区：输入框、"查询"按钮、结果卡片、"添加" / "已添加"、错误提示、键盘处理 | 依赖: T2 | 文件: apps/native/src/favorites-screen.tsx, apps/native/src/search-panel.tsx, apps/native/App.tsx | 层: 前端
- [x] T4 收藏列表：展示、下拉刷新、编辑备注、系统弹窗确认删除、空状态、加载和错误状态 | 依赖: T3 | 文件: apps/native/src/favorite-list.tsx, apps/native/src/favorites-screen.tsx | 层: 前端
- [ ] R 代码评审：Codex 一轮，修 P0/P1，P2 记到遗留 | 依赖: T4 | 层: 评审
- [ ] TA 后端测试：e2e/05-github-favorites-native.api.spec.ts 覆盖所有"验证: api"的 AC（AC1：执行 export:ios 和 export:android 都成功） | 依赖: T4 | 层: 后端测试
- [ ] TU 前端测试：本模块没有"验证: ui"的 AC（原生界面由人工在模拟器验证），确认 scripts/acceptance.sh 05-github-favorites-native --layer ui 通过即可 | 依赖: T4 | 层: 前端测试
- [ ] TZ 总测试：check-types、check、scripts/acceptance.sh 05-github-favorites-native 全部通过；人工 AC 在 iOS 模拟器逐条验证 | 依赖: R, TA, TU | 层: 总测试

## 遗留
<!-- 评审中没修的 P2 记在这里 -->
