# GitHub 用户收藏（Web） · 设计

## 数据库
无。数据在 AWS Aurora 里，本仓库不新增 Prisma model。

## 共享包（新建 packages/github-users）
包名 `@jax-workflow-project/github-users`，Web 的服务端（tRPC）和 React Native 共用，只依赖 `zod`，不依赖 Node 或浏览器专有 API（用全局 `fetch`）。

- `src/schema.ts`：zod schema 和类型（字段统一转成 camelCase）
  - `githubProfileSchema`：`githubId: number`、`login: string`、`name / avatarUrl / bio / company / location: string | null`、`publicRepos / followers: number | null`
  - `favoriteUserSchema`：`githubProfileSchema` + `note: string | null`、`createdAt: string`、`updatedAt: string`
  - `usernameSchema`：1–39 位，只含字母、数字、连字符
  - `noteSchema`：`string`（最长 1000）或 `null`
  - 从 AWS 原始响应（snake_case）转换时，`github_id` 用 `z.coerce.number()`，兼容后端返回字符串
- `src/client.ts`：`GITHUB_USERS_API_URL` 常量 + `createGithubUsersClient(baseUrl = GITHUB_USERS_API_URL)`，返回 `{ search(username), list(), create(profile), update(githubId, note), delete(githubId) }`
  - 请求超时 35 秒（数据库唤醒最长约 25 秒）
  - 非 2xx 抛 `GithubUsersApiError`，带 `status`（HTTP 状态码）和后端的 `error` 文本；超时或网络错误时 `status` 为 0
- `src/index.ts`：统一导出

## 接口（tRPC，packages/api/src/routers/github-favorite.ts）
| procedure | query / mutation | 入参（zod） | 出参（zod，契约里写成 `.output()`） | public / protected / 仅管理员 |
|---|---|---|---|---|
| `githubFavorite.search` | query | `{ username: usernameSchema }` | `githubProfileSchema` | public |
| `githubFavorite.list` | query | 无 | `{ users: favoriteUserSchema[] }` | public |
| `githubFavorite.create` | mutation | `githubProfileSchema` | `favoriteUserSchema` | public |
| `githubFavorite.update` | mutation | `{ githubId: number, note: noteSchema }` | `favoriteUserSchema` | public |
| `githubFavorite.delete` | mutation | `{ githubId: number }` | `{ githubId: number }` | public |

AWS 错误到 tRPC 错误码的映射：400 → `BAD_REQUEST`，404 → `NOT_FOUND`，429 → `TOO_MANY_REQUESTS`，502 / 5xx → `BAD_GATEWAY`，超时或网络错误 → `GATEWAY_TIMEOUT`。

## 页面（apps/web/src/app/）
| 路由 | 作用 | 调用的接口 |
|---|---|---|
| `/github` | 顶部：用户名输入框 + "查询"按钮 + 查询结果卡片（"添加" / "已添加"）；下方：收藏列表（头像、用户名、姓名、粉丝数、备注、"编辑备注"、"删除"） | `githubFavorite.search`、`list`、`create`、`update`、`delete` |

头部导航（`apps/web/src/components/header.tsx`）加一个指向 `/github` 的入口。

## 涉及的文件
- 新建：`packages/github-users/package.json`、`packages/github-users/tsconfig.json`、`packages/github-users/src/schema.ts`、`packages/github-users/src/client.ts`、`packages/github-users/src/index.ts`
- 新建：`packages/api/src/routers/github-favorite.ts`
- 新建：`apps/web/src/app/github/page.tsx`、`apps/web/src/app/github/search-panel.tsx`、`apps/web/src/app/github/favorite-list.tsx`
- 修改：`packages/api/src/routers/index.ts`、`packages/api/package.json`、`apps/web/package.json`、`apps/web/src/components/header.tsx`

## 测试说明
- 前端测试需要模拟空列表、慢响应和错误时，用 Playwright 的 `page.route` 拦截浏览器发往 `http://localhost:3000/trpc/...` 的请求。Web 的 tRPC 客户端用的是 `httpBatchLink`：URL 形如 `/trpc/githubFavorite.list?batch=1&input=...`，多个调用可能合并在一个请求里（路径用逗号分隔），响应是数组 `[{ "result": { "data": ... } }]` 或 `[{ "error": ... }]`
- 其他前端测试和后端测试走真实链路（tRPC → AWS），只使用固定测试账号（如 `octocat`、`github`），测试结束删除自己添加的记录

## 边界情况
- 输入框为空或只有空格 → "查询"按钮不可点
- 用户名不合法 → 提示"用户名只能包含字母、数字和连字符，最长 39 位"，不发请求到 AWS
- 用户不存在 → 显示"没有找到这个 GitHub 用户"，不显示"添加"
- GitHub 限流或出错（429 / 502） → 提示"GitHub 暂时不可用，请稍后再试"
- 请求超时或网络错误 → 提示"服务暂时不可用，请稍后再试"，可以重试
- 查询到的人已经在收藏列表里 → 结果卡片直接显示"已添加"
- 连续点击"添加" / "保存" / "删除" → 请求进行中按钮不可点，只生效一次
- 备注超过 1000 字 → 提示并拒绝提交
- 备注保存为空字符串 → 当作清空备注（存 `null`）
- 删除时这个人已经被别处删掉（`NOT_FOUND`） → 从列表移除并提示"已被删除"
- 列表请求失败 → 列表区域显示错误和"重试"按钮，不影响上方查询
