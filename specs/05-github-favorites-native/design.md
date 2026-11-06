# GitHub 用户收藏（Android / iOS） · 设计

## 数据库
无。

## 接口
不新增 tRPC 接口。App 直接用模块 04 的共享包 `@jax-workflow-project/github-users` 里的 `createGithubUsersClient()` 请求 AWS：`search`、`list`、`create`、`update`、`delete`。请求状态用 `@tanstack/react-query` 管理（查询、列表、三个写操作的 mutation，写操作成功后让列表重新获取）。

## 应用结构（新建 apps/native）
Expo + TypeScript 单屏应用，放在 pnpm workspace 的 `apps/native`，包名 `native`。

| 屏幕 | 作用 | 调用 |
|---|---|---|
| 收藏页（唯一的屏幕） | 顶部：用户名输入框 + "查询"按钮 + 查询结果卡片（"添加" / "已添加"）；下方：收藏列表（头像、用户名、姓名、粉丝数、备注、"编辑备注"、"删除"），支持下拉刷新 | `search`、`list`、`create`、`update`、`delete` |

脚本约定：
- 启动用 `start`（`expo start`），**不要叫 `dev`**，否则根目录 `pnpm dev`（turbo）会把 Expo 一起拉起来
- 提供 `check-types`（`tsc --noEmit`），纳入根目录 `pnpm check-types`
- 提供 `export:ios` / `export:android`（`expo export --platform ios|android`，输出到被 git 忽略的目录），给 AC1 用
- Metro 需要按 Expo 官方的 monorepo 说明配置，能解析 workspace 包 `@jax-workflow-project/github-users`；不要修改根目录 `.npmrc` 的依赖安装方式（会影响 web 和 server），如果必须改，先停下来说明原因

## 涉及的文件
- 新建：`apps/native/package.json`、`apps/native/app.json`、`apps/native/tsconfig.json`、`apps/native/metro.config.js`、`apps/native/index.ts`、`apps/native/App.tsx`、`apps/native/.gitignore`
- 新建：`apps/native/src/api.ts`（共享客户端实例 + react-query hooks）、`apps/native/src/favorites-screen.tsx`、`apps/native/src/search-panel.tsx`、`apps/native/src/favorite-list.tsx`
- 修改：`pnpm-lock.yaml`（安装依赖产生）

## 边界情况
- 输入框为空或只有空格 → "查询"按钮不可点
- 用户名不合法 → 提示"用户名只能包含字母、数字和连字符，最长 39 位"，不发请求
- 用户不存在 → 显示"没有找到这个 GitHub 用户"，不显示"添加"
- GitHub 限流或出错（429 / 502） → 提示"GitHub 暂时不可用，请稍后再试"
- 请求超时或断网 → 提示"服务暂时不可用，请稍后再试"，可以重试
- 已经在收藏列表里的人 → 结果卡片直接显示"已添加"
- 请求进行中 → 对应按钮不可点、显示加载状态，只生效一次
- 备注超过 1000 字 → 提示并拒绝提交；保存空字符串 → 清空备注
- 删除时对方已不存在（404） → 从列表移除并提示"已被删除"
- 收藏列表为空 → 显示"还没有收藏任何人"
- 键盘弹出 → 不遮挡输入框和操作按钮
