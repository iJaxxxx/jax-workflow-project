# 后台访问控制 · 设计

## 技术选型说明
**不用** Better-Auth 的 `admin` 插件，改用 `user.additionalFields` 自己加字段。原因：`admin` 插件会暴露 `/api/auth/admin/*` 一组接口（包括封禁用户），这些接口绕过了"新接口一律写成 tRPC"的约定，也绕过了模块 03 的操作日志。

## 数据库
修改 `packages/db/prisma/schema/auth.prisma` 中的 `User`：

```prisma
model User {
  // ...已有字段
  role          String    @default("user") // "user" | "admin"
}
```

`packages/auth/src/index.ts` 中同步声明：

```ts
user: {
  additionalFields: {
    role: { type: ["user", "admin"], required: false, defaultValue: "user", input: false },
  },
},
```

`input: false` 是必须的：防止注册接口通过 body 自己设置 `role`（越权）。

## 接口（tRPC，packages/api/src/）
本模块不新增业务 procedure，只新增一个 procedure 类型：

| 名称 | 位置 | 作用 |
|---|---|---|
| `adminProcedure` | `packages/api/src/index.ts` | 基于 `protectedProcedure`，`ctx.session.user.role !== "admin"` 时抛 `TRPCError({ code: "FORBIDDEN" })`；后续模块的管理接口都用它 |

## 页面（apps/web/src/）
| 路由 / 文件 | 作用 | 调用的接口 |
|---|---|---|
| `src/proxy.ts` | Next 16 的 Proxy（原 middleware）。matcher `/dashboard/:path*`。调用 `${NEXT_PUBLIC_SERVER_URL}/api/auth/get-session`（透传 cookie），无会话时重定向到 `/login?redirect=<pathname+search>` | Better-Auth `get-session` |
| `src/app/dashboard/layout.tsx` | 服务端组件。用 `authClient.getSession({ fetchOptions: { headers: await headers() } })` 再取一次会话：无会话 → `redirect("/login")`（兜底）；`role !== "admin"` → 渲染"无权限访问"组件，**不渲染 children**；管理员 → 渲染后台头部 + children | Better-Auth `get-session` |
| `src/app/dashboard/page.tsx` | 改写脚手架页面：去掉 `privateData` 示例，显示后台首页（欢迎语 + 指向用户管理、操作日志的链接） | 无 |
| `src/app/dashboard/dashboard.tsx` | 删除（脚手架示例） | — |
| `src/components/admin-header.tsx` | 客户端组件：显示管理员名字、邮箱，导航"用户管理 `/dashboard/users`""操作日志 `/dashboard/logs`"，退出按钮（`authClient.signOut` 成功后 `router.push("/login")`） | Better-Auth `sign-out` |
| `src/components/forbidden.tsx` | "无权限访问"提示，附返回首页链接 | 无 |
| `src/app/login/page.tsx` | 读取 `redirect` 查询参数传给登录、注册表单；页面需包在 `<Suspense>` 里（`useSearchParams` 要求） | — |
| `src/components/sign-in-form.tsx`、`sign-up-form.tsx` | 成功后跳到 `safeRedirect(redirect)`，不再写死 `/dashboard` | — |
| `src/lib/safe-redirect.ts` | `safeRedirect(value?: string | null): string`：只接受以 `/` 开头、且不以 `//` 或 `/\` 开头的路径，否则返回默认值 `"/"` | — |
| `src/lib/auth-client.ts` | 加 `inferAdditionalFields<typeof auth>()`（或手写 `{ user: { role: { type: "string" } } }`）让客户端能拿到 `session.user.role` 的类型 | — |

## 涉及的文件
- 新建：`apps/web/src/proxy.ts`、`apps/web/src/app/dashboard/layout.tsx`、`apps/web/src/components/admin-header.tsx`、`apps/web/src/components/forbidden.tsx`、`apps/web/src/lib/safe-redirect.ts`
- 修改：`packages/db/prisma/schema/auth.prisma`、`packages/auth/src/index.ts`、`packages/api/src/index.ts`、`apps/web/src/lib/auth-client.ts`、`apps/web/src/app/dashboard/page.tsx`、`apps/web/src/app/login/page.tsx`、`apps/web/src/components/sign-in-form.tsx`、`apps/web/src/components/sign-up-form.tsx`
- 删除：`apps/web/src/app/dashboard/dashboard.tsx`
- `packages/api/src/routers/index.ts` 里的 `privateData` 示例保留不动（其他地方没用到也不影响）

## 边界情况
- 未登录访问子页面：Proxy 带上完整的 `pathname + search` 作为 `redirect`
- Proxy 只做"有没有会话"的乐观检查；角色校验以 layout 为准，接口权限以 `adminProcedure` 为准（三层都要有，不能只靠前端）
- 会话 cookie 存在但已过期 / 已被删：Proxy 拿到 `null` 会话，同样跳登录
- `redirect` 参数是外部地址、`//` 开头、`javascript:` 等：一律回退到 `/`
- 已登录用户访问 `/login?redirect=...`：保持脚手架原有行为，不额外处理
- 普通用户访问后台：layout 不渲染 children，所以子页面的数据请求也不会发出
- 注册时伪造 `role`：`input: false` 拦截
