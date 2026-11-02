# 模块名 · 任务

基线提交: <!-- 开发这个模块之前的 HEAD，进入 B 阶段时写入 -->

- [ ] T1 数据库 + tRPC 接口签名（契约：入参出参定死，实现先抛 NOT_IMPLEMENTED） | 依赖: 无 | 文件: packages/db/prisma/schema/xxx.prisma, packages/api/src/routers/xxx.ts | 层: 契约
- [ ] T2 一句话描述 | 依赖: T1 | 文件: packages/api/src/routers/xxx.ts | 层: 后端
- [ ] T3 一句话描述 | 依赖: T1 | 文件: apps/web/src/app/xxx/page.tsx | 层: 前端
- [ ] R 代码评审：Codex 一轮，修 P0/P1，P2 记到遗留 | 依赖: T2, T3 | 层: 评审
- [ ] TA 后端测试：e2e/<模块名>.api.spec.ts 覆盖所有"验证: api"的 AC | 依赖: T2 | 层: 后端测试
- [ ] TU 前端测试：e2e/<模块名>.ui.spec.ts 覆盖所有"验证: ui"的 AC | 依赖: T3 | 层: 前端测试
- [ ] TZ 总测试：check-types、check、scripts/acceptance.sh <模块名> 全部通过 | 依赖: R, TA, TU | 层: 总测试

## 遗留
<!-- 评审中没修的 P2 记在这里 -->
