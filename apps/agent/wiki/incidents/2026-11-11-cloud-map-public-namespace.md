---
summary: 2026-11-11 事故：Cloud Map 命名空间 jax.local 被建成公有 DNS，Lambda 报 ENOTFOUND go-github-users.jax.local，线上 502
---

# 2026-11-11 Cloud Map 命名空间被建成公有的

## 现象

- Lambda go-caller-sam 报 `ENOTFOUND go-github-users.jax.local`，Lambda Errors 增加。
- 线上请求返回 502。

## 根因

Cloud Map 命名空间 `jax.local` 被建成了**公有 DNS 命名空间**，而不是私有的。公有命名空间的记录在 VPC 内解析不到，Lambda 找不到 ECS 服务。

## 修复

1. 删除公有命名空间 `jax.local`。
2. 重建为关联 VPC **jax-vpc-01** 的私有 DNS 命名空间。
3. 重新注册服务 go-github-users。

## 教训

- 建 Cloud Map 命名空间时确认类型是「私有 DNS」并关联正确的 VPC。
- 手动切 Lambda 别名（live）后要注意：CloudFormation 回滚会把别名切回 CFN 记录的版本（drift），手动改动会被覆盖。

## 相关页面

- [ENOTFOUND *.jax.local](../errors/enotfound-jax-local.md)
- [请求链路](../architecture/request-chain.md)
