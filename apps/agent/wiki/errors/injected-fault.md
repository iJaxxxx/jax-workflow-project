---
summary: 报错 "injected fault: simulated database query timeout" 来自 /debug/fail 故障演练，不是真实数据库故障；配套告警 jax-gh-rest-5xx
---

# injected fault: simulated database query timeout

## 症状

- ECS 日志（`/ecs/go-github-users`）里出现：`injected fault: simulated database query timeout`，接口路径是 `/debug/fail`。
- API Gateway 5XXError 上升，告警 **jax-gh-rest-5xx** 响（条件：AWS/ApiGateway 5XXError > 0，周期 1 分钟）。
- Lambda Errors 通常为 0：后端返回 5xx 时 go-caller 只记 warn 照常返回，原因见 [请求链路](../architecture/request-chain.md)。

## 原因

这是 [go-github-users](../services/go-github-users.md) 的 `/debug/fail` 故障演练接口，固定返回 500。报错文字里的「database query timeout」是模拟的，**不是真实的数据库故障，不需要排查 Aurora**。

## 处理

1. 确认是否有人在做故障演练（问一下团队）。
2. 是演练：停止调用 `/debug/fail` 即可，告警会在没有新 5xx 后自动恢复。
3. 不是演练：说明有人或程序在误调这个接口，按来源 IP 排查调用方。
