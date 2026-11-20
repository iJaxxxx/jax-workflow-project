---
summary: Lambda 报 ENOTFOUND go-github-users.jax.local（*.jax.local 解析不到）→ 先检查 Cloud Map 命名空间是不是私有的
---

# ENOTFOUND *.jax.local

## 症状

Lambda 日志（`/aws/lambda/go-caller-sam`）里出现 `ENOTFOUND go-github-users.jax.local`，Lambda Errors 增加，线上返回 502。

## 先查什么

1. Cloud Map 命名空间 `jax.local` 是不是**私有 DNS 命名空间**，并且关联了 VPC jax-vpc-01。
2. 服务 go-github-users 在命名空间里有没有注册实例（ECS 任务是否在运行）。

## 历史事故

- [2026-11-11 Cloud Map 命名空间被建成公有的](../incidents/2026-11-11-cloud-map-public-namespace.md)

相关：[请求链路](../architecture/request-chain.md)
