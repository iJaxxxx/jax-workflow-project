# 项目说明

## 技术栈与目录

Better-T-Stack 生成的 pnpm + Turborepo monorepo。

| 位置 | 作用 |
|---|---|
| `apps/web` | Next.js 前端，端口 3001。页面在 `src/app/`，组件在 `src/components/`，tRPC 客户端在 `src/utils/trpc.ts` |
| `apps/server` | Hono 后端，端口 3000。挂载 `/api/auth/*`（Better-Auth）和 `/trpc/*` |
| `packages/api` | tRPC。`src/index.ts` 定义 `publicProcedure` / `protectedProcedure`，路由写在 `src/routers/` |
| `packages/db` | Prisma + PostgreSQL。schema 在 `prisma/schema/`（`auth.prisma` 是认证表，业务表写在 `schema.prisma` 或新建文件） |
| `packages/auth` | Better-Auth 配置 |
| `packages/ui` | 共享 UI 组件（shadcn） |
| `apps/fumadocs` | 文档站 |

## 约定

- 新接口一律写成 tRPC procedure，放在 `packages/api/src/routers/`，在 `routers/index.ts` 注册；不要在 Hono 里直接加业务路由
- 需要登录的接口用 `protectedProcedure`
- 改了 Prisma schema 后执行 `pnpm db:push`
- 环境变量在各包的 `.env`，字段定义见 `.env.schema`；不要把 `.env` 提交到 Git
- 提交前 `pnpm check` 必须通过（Ultracite / Biome）
- Next.js 版本较新，写前端前先看 `apps/web/AGENTS.md`
- Skills 和 MCP 只装在项目里（`.agents/skills`、`.mcp.json`），不装全局

## 常用命令

- `pnpm dev`：同时启动 web 和 server
- `pnpm db:push` / `pnpm db:studio`：同步表结构 / 打开数据库面板
- `pnpm check` / `pnpm fix`：检查 / 自动修复代码风格
- `pnpm check-types`：类型检查

## 开发工作流

需求开发统一走 `/jax-workflow [PRD 或模块名]`，流程见 `docs/workflow.md`。入口先判断 `specs/` 的状态：

- specs 不存在或不完整 → 读 `docs/prd/` 下的 PRD，拆成 `specs/NN-模块/{requirements,design,tasks}.md`，写 `specs/status.md`（`状态: 待确认`），然后停下来等人工确认
- `specs/status.md` 是 `状态: 已确认` → 从第一个未勾选的 task 断点续跑：开发 → 一轮评审 → 冒烟测试 → 提交

## 测试账号

- （本地注册后填在这里，例如 `admin@test.local`）

## 经验

<!-- /jax-workflow 每轮结束后把踩过的坑追加在这里 -->

---

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `pnpm exec ultracite fix`
- **Check for issues**: `pnpm exec ultracite check`
- **Diagnose setup**: `pnpm exec ultracite doctor`

Biome (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome will catch most mechanical issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `pnpm exec ultracite fix` before committing to ensure compliance.
