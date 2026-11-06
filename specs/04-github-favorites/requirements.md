# GitHub 用户收藏（Web）

## 背景
在 Web 上按用户名查询 GitHub 用户、加入收藏，并在同一个列表页查看、修改备注、删除已收藏的人。数据存在已部署的 AWS HTTP API 里，本仓库通过 tRPC 转发调用，同时沉淀一个 Web 和 React Native 共用的 API 包。

## 用户故事
- 作为访客，我想要输入 GitHub 用户名查询到这个人的资料，以便决定要不要收藏
- 作为访客，我想要把查询结果添加到收藏列表，以便以后查看
- 作为访客，我想要在收藏列表里修改某个人的备注、删除某个人，以便维护列表

## 验收标准
- [ ] AC1：给定存在的 GitHub 用户名（如 `octocat`），当调用 `githubFavorite.search`，那么返回该用户的 `githubId`（数字）、`login`、`name`、`avatarUrl`、`followers` 等资料 | 验证: api
- [ ] AC2：给定不存在的用户名，当调用 `githubFavorite.search`，那么返回 `NOT_FOUND`；给定非法用户名（含空格或特殊字符、超过 39 位），那么返回 `BAD_REQUEST` 且不会请求 AWS | 验证: api
- [ ] AC3：给定查询到的用户，当调用 `githubFavorite.create`，那么 `githubFavorite.list` 里出现这个人，`githubId` 是数字、`note` 为空；对同一个人再次 `create` 不会产生重复记录 | 验证: api
- [ ] AC4：给定已收藏的用户，当调用 `githubFavorite.update` 设置备注，那么 `list` 里这个人的 `note` 变为新值；传 `note: null` 时清空备注；对不存在的 `githubId` 调用返回 `NOT_FOUND` | 验证: api
- [ ] AC5：给定已收藏的用户，当调用 `githubFavorite.delete`，那么 `list` 里不再有这个人；再删一次返回 `NOT_FOUND` | 验证: api
- [ ] AC6：给定共享包 `@jax-workflow-project/github-users` 的客户端直接请求 AWS，当调用 `list()`，那么每条记录的 `githubId` 都是数字（后端返回字符串时也能正确转换） | 验证: api
- [ ] AC7：给定打开 `/github`，那么页面顶部是用户名输入框和"查询"按钮，下方是收藏列表；输入框为空时"查询"按钮不可点 | 验证: ui
- [ ] AC8：给定输入存在的用户名并点"查询"（或按回车），那么在输入框下方显示查询结果：头像、用户名、姓名、粉丝数和"添加"按钮 | 验证: ui
- [ ] AC9：给定查询结果，当点"添加"，那么这个人出现在下方收藏列表里，查询结果上的按钮变为"已添加"且不可点 | 验证: ui
- [ ] AC10：给定收藏列表里的某个人，当点"编辑备注"、输入备注并保存，那么列表里显示新备注，刷新页面后备注仍在 | 验证: ui
- [ ] AC11：给定收藏列表里的某个人，当点"删除"并在确认框里确认，那么这个人从列表消失；在确认框里点取消则不删除 | 验证: ui
- [ ] AC12：给定输入不存在的用户名并查询，那么显示"没有找到这个 GitHub 用户"，不显示"添加"按钮 | 验证: ui
- [ ] AC13：给定 `githubFavorite.list` 返回空列表（测试里拦截浏览器发往 `/trpc` 的请求，返回 `users: []`），那么收藏列表区域显示"还没有收藏任何人" | 验证: ui
- [ ] AC14：给定接口响应被延迟 3 秒（测试里拦截 `/trpc` 请求后延迟放行），那么：列表加载期间显示加载状态；查询进行中"查询"按钮不可点；添加进行中"添加"按钮不可点；在此期间连续点击多次，`githubFavorite.search` 和 `githubFavorite.create` 各只发出 1 次请求 | 验证: ui
- [ ] AC15：给定输入非法用户名（如 `bad name!`）并点"查询"，那么显示"用户名只能包含字母、数字和连字符，最长 39 位"，浏览器不发出 `githubFavorite.search` 请求 | 验证: ui
- [ ] AC16：给定 `githubFavorite.search` 返回 `TOO_MANY_REQUESTS` 或 `BAD_GATEWAY`（测试里拦截返回对应错误），那么显示"GitHub 暂时不可用，请稍后再试"；给定 `githubFavorite.list` 返回错误，那么列表区域显示错误和"重试"按钮，点"重试"后重新请求列表，上方查询区仍可正常使用 | 验证: ui
- [ ] AC17：给定编辑备注时输入超过 1000 字，那么提示"备注最多 1000 字"且不发出 `githubFavorite.update` 请求；给定把备注改成空字符串并保存，那么 `githubFavorite.update` 收到的 `note` 为 `null`，列表里不再显示备注 | 验证: ui
- [ ] AC18：给定删除时这个人已经被别处删除（`githubFavorite.delete` 返回 `NOT_FOUND`，测试里拦截返回），那么这个人从列表移除并提示"已被删除" | 验证: ui

## 假设
- 不需要登录：AWS 接口本身是公开的，页面 `/github` 和 `githubFavorite.*` 都用 `publicProcedure`
- Web 不在浏览器里直接请求 AWS，而是走本仓库的 tRPC（服务端转发），这样不受 AWS 接口未配置 CORS 的影响，也符合"新接口写成 tRPC procedure"的约定
- "修改"只修改备注 `note`；GitHub 资料以 GitHub 为准，想更新资料就重新查询后再"添加"（后端会覆盖更新）
- 查询一次只返回一个人（按用户名精确查询），"查询结果列表"就是这一条结果
- 收藏列表按添加时间倒序，最多显示后端返回的 100 条，不分页
- AWS Base URL 写成共享包里的常量，不新增环境变量
- 自动测试会真实读写线上数据：只使用固定的测试账号（如 `octocat`、`github`），测试结束删除自己添加的记录；GitHub 匿名接口每小时 60 次的限流可能导致偶发失败

## 不做的事
- 登录、鉴权、按用户隔离收藏
- 按关键词模糊搜索多个 GitHub 用户
- 批量操作、分页、排序切换
- 修改 AWS 后端或数据库
