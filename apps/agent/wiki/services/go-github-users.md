---
summary: ECS 上的 Go 服务 go-github-users：接口列表、slog JSON 日志格式、/debug/fail 故障演练接口、部署方式
---

# go-github-users

Go 写的 HTTP 服务，跑在 ECS Fargate（集群 jax-cluster），端口 8080，通过 Cloud Map 名字 `go-github-users.jax.local` 被 Lambda 调用。在整条链路中的位置见 [请求链路](../architecture/request-chain.md)。

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /healthz | 健康检查 |
| GET | /github?username= | 查询 GitHub 用户 |
| GET | /users/list | 用户列表 |
| POST | /users/create | 新建用户 |
| POST | /users/update | 更新用户 |
| POST | /users/delete | 删除用户 |
| GET | /debug/fail | **故障演练用**，固定返回 500，见 [injected fault](../errors/injected-fault.md) |

## 日志

- 日志组 `/ecs/go-github-users`。
- 格式是 slog JSON，一行一条；报错行带 `"level":"ERROR"`，搜日志时用这个关键词。

## 部署

GitHub Actions：推到 main 分支后自动构建镜像并部署到 ECS。异常开始的时间如果和最近一次部署吻合，优先怀疑这次发布。
