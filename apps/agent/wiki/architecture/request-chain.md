---
summary: 线上请求链路总览：WAF → API Gateway → Lambda go-caller-sam → Cloud Map → ECS go-github-users → Aurora，含日志组和告警
---

# 请求链路

区域：ap-southeast-2。

```
浏览器
 → WAF（jax-gh-waf，规则含限流：每个 IP 5 分钟内 100 次）
 → API Gateway REST API jax-gh-rest（stage prod）
 → Lambda go-caller-sam（别名 live）
 → Cloud Map 私有 DNS go-github-users.jax.local:8080
 → ECS Fargate 服务 go-github-users（集群 jax-cluster）
 → Aurora PostgreSQL Serverless v2 jax-aurora
```

## 各层要点

| 层 | 资源 | 说明 |
|---|---|---|
| WAF | jax-gh-waf | 触发限流时返回 403，不会进到后面 |
| API Gateway | jax-gh-rest / prod | 告警 jax-gh-rest-5xx 看的是这一层的 5XXError |
| Lambda | go-caller-sam，别名 live | SAM 灰度发布 Canary10Percent5Minutes，回滚告警 go-caller-sam-live-errors |
| 服务发现 | go-github-users.jax.local:8080 | 必须是关联 VPC 的**私有** DNS 命名空间，见 [Cloud Map 公有命名空间事故](../incidents/2026-11-11-cloud-map-public-namespace.md) |
| ECS | go-github-users / jax-cluster | Go 服务，见 [go-github-users](../services/go-github-users.md) |
| 数据库 | jax-aurora | Aurora PostgreSQL Serverless v2 |

## 日志组

- Lambda：`/aws/lambda/go-caller-sam`
- ECS：`/ecs/go-github-users`

## go-caller（Lambda）怎么处理后端错误

- 后端返回 5xx：只记一条 warn 日志，把响应照常返回。**Lambda Errors 指标不会增加**，但 API Gateway 的 5XXError 会增加。所以「入口有 5xx、Lambda Errors 为 0」说明问题在 ECS 服务里。
- 连不上后端（DNS 解析失败、超时、拒绝连接）：直接抛错，**Lambda Errors 增加**，例如 [ENOTFOUND *.jax.local](../errors/enotfound-jax-local.md)。

## 相关页面

- [go-github-users 服务](../services/go-github-users.md)
- [injected fault 报错](../errors/injected-fault.md)
- [ENOTFOUND *.jax.local](../errors/enotfound-jax-local.md)
