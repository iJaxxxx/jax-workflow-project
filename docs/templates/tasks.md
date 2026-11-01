# 模块名 · 任务

基线提交: <!-- 开发这个模块之前的 HEAD，进入 B1 时写入 -->

- [ ] T1 一句话描述 | 依赖: 无 | 文件: packages/db/prisma/schema/xxx.prisma | 串行
- [ ] T2 一句话描述 | 依赖: T1 | 文件: packages/api/src/routers/xxx.ts | 可并行
- [ ] T3 一句话描述 | 依赖: T1 | 文件: apps/web/src/app/xxx/page.tsx | 可并行
- [ ] R 代码评审：Codex 一轮，修 P0/P1，P2 记到遗留 | 依赖: T2, T3 | 串行
- [ ] T4 验收：e2e/<模块名>.spec.ts 覆盖所有 e2e 的 AC，scripts/acceptance.sh 通过 | 依赖: R | 串行

## 遗留
<!-- 评审中没修的 P2 记在这里 -->
