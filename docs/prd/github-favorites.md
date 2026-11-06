# GitHub 用户收藏

## 背景
想把感兴趣的 GitHub 用户收藏起来，随时查看、写备注、删除。后端已经部署在 AWS（API Gateway + Lambda + Aurora），本仓库只做前端：Web 用 Next.js，Android 和 iOS 用 React Native 一套代码写双端。

## 功能
一个列表页，列表上方有输入框：

1. 输入一个 GitHub 用户名，查询得到结果。
2. 查询结果可以"添加"。
3. 添加完成后，同一个列表页可以查看已添加的人，并且可以修改（备注）、删除。

## 平台
- Web：Next.js（现有 `apps/web`）
- Android / iOS：React Native 双端

## 已有后端（AWS HTTP API，不在本仓库）
Base URL：`https://lsmygs2ye8.execute-api.ap-southeast-2.amazonaws.com`（公开、暂无鉴权、暂未配置 CORS）

| 方法 | 路径 | 入参 | 返回 |
|---|---|---|---|
| GET | `/github?username=xxx` | 查询参数 `username` | 200 GitHub 用户 `{github_id, login, name, avatar_url, bio, company, location, public_repos, followers}`；404 用户不存在；400 用户名非法；502 GitHub 出错 |
| GET | `/users/list` | 无 | 200 `{count, users: [{github_id, login, name, avatar_url, bio, company, location, public_repos, followers, note, created_at, updated_at}]}` |
| POST | `/users/create` | body 为查询返回的用户对象 | 201 新增 / 200 已存在则用新资料更新 |
| POST | `/users/update` | `{github_id: number, note: string \| null}` | 200 更新后的用户 / 404 |
| POST | `/users/delete` | `{github_id: number}` | 200 `{deleted}` / 404 |

错误统一返回 `{error: string}`。`github_id` 在 `/users/list` 里目前可能是字符串（后端正在改成数字）。数据库在闲置后会暂停，暂停后的第一个请求可能要 15～25 秒。
