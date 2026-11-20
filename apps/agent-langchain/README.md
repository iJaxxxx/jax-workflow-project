# agent-langchain：LangChain.js + LangGraph 版运维助手

和 `apps/agent`（Mastra 版）做的是同一件事：排查 AWS 上 `jax-gh-rest` 这条链路（API Gateway → Lambda → ECS → Aurora）的故障。两边用同一个本地模型（Ollama `qwen3:8b`）、同一套工具、同一份运维 wiki 和提示词，方便对照两个框架的写法。

两边共用的业务逻辑都放在 `packages/ops-core`，这个包不依赖任何 Agent 框架：

| ops-core 里的文件 | 内容 |
|---|---|
| `src/aws/*.ts` | 6 个只读 AWS 查询（告警、API Gateway 指标、Lambda 指标、日志搜索、Lambda 部署、ECS 服务） |
| `src/evidence.ts` | 七项证据的并行收集、取证清单、「一键取证」的返回值 |
| `src/wiki.ts` | 运维 wiki 的列出、读取、提交修改建议（目录是 `apps/agent/wiki/`，两边共用） |
| `src/docs.ts` | search-docs 的相似度过滤（MIN_SCORE 0.6），检索本身用 `packages/rag` |
| `src/prompts.ts` / `src/report-prompt.ts` | 运维助手和报告员的系统提示词、报告输入 |

两个框架各自只写一层很薄的外壳：工具定义、Agent、编排和命令行。

## 前置条件

```bash
aws login                      # 工具走 SDK 默认凭证链，全部只读
ollama serve                   # 默认 http://localhost:11434，可用 OLLAMA_URL 覆盖（带不带 /v1 都行）
ollama pull qwen3:8b           # 对话模型，可用 OLLAMA_MODEL 覆盖
pnpm --filter @jax-workflow-project/rag ingest   # search-docs 用的向量索引（只需建一次）
```

## 命令

```bash
# 单轮排障：Agent 自己决定调哪些工具，打印每次工具调用和结果摘要，最后打印回答
pnpm --filter agent-langchain ops "jax-gh-rest-5xx 告警，看下什么原因"

# 排障图：七项证据由代码并行查全，模型只写报告
pnpm --filter agent-langchain diagnose "jax-gh-rest-5xx 告警响了，帮我定位原因"

# 多轮对话：一行一个问题，同一个线程里记得上文；传线程 id 可以接着上次聊
pnpm --filter agent-langchain chat [线程 id]
printf '问题1\n追问\n' | pnpm --filter agent-langchain chat   # 也可以用管道喂多轮

# LangGraph 本地服务（Studio 用的 API），端口 2024
pnpm --filter agent-langchain studio
```

stderr 上的 `[wiki-guard] 打回重试 …` 表示中间件打回了模型这一次的回复（见下文）。

### LangGraph Studio

`pnpm --filter agent-langchain studio` 会启动 `langgraphjs dev`（`@langchain/langgraph-cli`），读取 `langgraph.json` 注册两张图：

- `ops_agent`：运维助手（`createAgent` 生成的图）
- `ops_diagnosis`：排障图

启动后：

- API：<http://localhost:2024>（`/ok`、`/assistants/search`、`/threads/{id}/runs/wait` 等），本地运行，不需要登录
- Studio 界面：<https://smith.langchain.com/studio?baseUrl=http://localhost:2024>，是 LangSmith 托管的网页，连接你本机的服务。这个页面需要登录 LangSmith 账号，这一点没有实测，以实际打开时为准

和 Mastra Playground 不同：Playground 的界面和服务都在本机 4111 端口，打开就能用；LangGraph 的服务在本机，界面在云端。服务端自带 checkpointer，线程和运行记录存在 `.langgraph_api/`（已加入 `.gitignore`）。

## 目录

```
src/
  model.ts               ChatOllama（不设置 think / numCtx，和 Mastra 版保持一致）
  tools/aws.ts           7 个 AWS 工具（含 collect-diagnosis-evidence），包 ops-core
  tools/wiki.ts          list-wiki-pages / read-wiki-page / propose-wiki-update
  tools/docs.ts          search-docs（packages/rag）
  agent/ops-agent.ts     createAgent：系统提示 + 工具 + 中间件 + checkpointer
  agent/middleware.ts    wikiGuard / historyWindow / toolErrors 三个中间件
  agent/file-saver.ts    存成 JSON 文件的 checkpointer（多轮记忆）
  graph/ops-diagnosis.ts StateGraph 排障图
  cli/run-agent.ts       ops / chat 共用的流式打印
  ops.ts chat.ts diagnose.ts studio.ts
langgraph.json           Studio / langgraphjs dev 的入口配置
```

## 概念对照：Mastra ↔ LangChain / LangGraph

| 要做的事 | Mastra（apps/agent） | LangChain / LangGraph（本目录） |
|---|---|---|
| 定义 Agent | `new Agent({ instructions, model, tools })` | `createAgent({ systemPrompt, model, tools })`（`langchain` 包），返回的是一张编译好的 LangGraph 图 |
| 连本地模型 | model router：`{ id: "ollama/qwen3:8b", url: ".../v1" }`，走 Ollama 的 OpenAI 兼容接口 | `new ChatOllama({ baseUrl, model })`（`@langchain/ollama`），走 Ollama 原生接口 |
| 定义工具 | `createTool({ id, description, inputSchema, outputSchema, execute })` | `tool(fn, { name, description, schema })`；没有 outputSchema，返回值直接成为 ToolMessage 的文本（这里统一 `JSON.stringify`） |
| 每步限制可用工具、补充提示 | `prepareStep` 返回 `activeTools`、`systemMessages` | 中间件的 `wrapModelCall`：改 `request.tools`、`request.systemMessage` 后再调 `handler` |
| 检查输出、打回重试 | 输出处理器 `processOutputStep` 里 `abort(msg, { retry: true })`，配合 `maxProcessorRetries` | 同一个 `wrapModelCall`：拿到 `handler` 的回复后检查，不合格就带着反馈再调一次 `handler`（重试循环自己写） |
| 工具报错交给模型 | 框架自动把 tool-error 回传给模型 | 默认也会转成 ToolMessage（英文提示）；这里用 `wrapToolCall` 中间件统一转成中文 |
| 步数上限 | `maxSteps: 10` | `recursionLimit`（按图的超级步算，一次模型调用加一次工具执行算 2 步，设为 21） |
| 多轮记忆 | `Memory` + `LibSQLStore`（`mastra.db`），调用时传 `memory: { thread, resource }` | checkpointer + `configurable.thread_id`；这里用自己写的 `JsonFileSaver`（`.data/checkpoints.json`） |
| 只带最近几条历史 | `new Memory({ options: { lastMessages: 10 } })` | 中间件 `historyWindow` 在 `wrapModelCall` 里截断发给模型的消息，checkpoint 里的完整历史不动 |
| 固定流程编排 | `createWorkflow().parallel([...7 步]).then(report).commit()` | `StateGraph`：`START` 连出 7 条边，`addEdge([...7 个节点], "reporter")` 汇合，`reporter → END` |
| 并行结果合并 | 自动：并行步骤的输出按 step id 拼成一个对象 | 要给状态字段配 reducer（`ReducedValue`），否则并行写同一个字段会报错 |
| 流式输出 | `agent.stream()` 的 `fullStream`：`tool-call` / `tool-result` / `text-delta` 事件 | `agent.stream(input, { streamMode })`：`"updates"` 按节点推送新消息，`"messages"` 逐 token 推送 |
| 调试界面 | `mastra dev` → Playground（本机 4111，界面也在本机） | `langgraphjs dev` → 本机 2024 的 API + LangSmith 托管的 Studio 页面 |
| 注册入口 | `new Mastra({ agents, workflows, storage })`（`src/mastra/index.ts`） | `langgraph.json` 里按「文件:导出名」列出图（`src/studio.ts`） |

## wiki-guard 中间件：怎么对应 Mastra 的 prepareStep + 输出处理器

8B 模型拿到证据后经常直接写回答、跳过 wiki。两边用同一套策略在代码里兜底：

1. **本轮还没调过任何工具**：只开放 AWS 工具和 search-docs，先把 wiki 工具藏起来
2. **已经取证、还没列 wiki**：只开放 `list-wiki-pages`，系统提示末尾加一句「现在只做一件事：调用 list-wiki-pages」
3. **已经列了、还没读**：只开放 `read-wiki-page`，提示「挑最相关的一页，调用一次 read-wiki-page」
4. **检查回复**：该调 wiki 工具却没调，或者回复是空的，就带着反馈重试，最多 2 次

Mastra 把这几件事分在两个地方：`prepareStep` 管 1~3（调模型前），输出处理器 `wikiGuard.processOutputStep` 管 4（调模型后），重试由框架驱动。

LangChain v1 的一个 `wrapModelCall` 中间件就能全包：先改请求（第 1~3 步），再调 `handler(request)`，拿到回复后检查（第 4 步），不合格就再调一次 `handler`。被打回的回复不会写进 state，线程历史里只留下合格的那次。

有一处要额外注意：checkpointer 里的 `state.messages` 是整个线程的历史，Mastra `prepareStep` 收到的 `steps` 只有本次运行。所以中间件先切出「最后一条用户消息之后」的本轮消息，再判断调过哪些工具。否则第二轮追问会被当成「已经查过 wiki」，约束就失效了。

Ollama 不支持 `toolChoice: "required"`，两边都只能靠「只开放一个工具 + 提示 + 打回重试」。

## 多轮记忆为什么没用官方的 SQLite checkpointer

`@langchain/langgraph-checkpoint-sqlite` 依赖 `better-sqlite3`，要本地编译原生模块，而仓库的 `pnpm-workspace.yaml`（`allowBuilds`）不允许它跑编译脚本。所以 `agent/file-saver.ts` 继承 LangGraph 自带的 `MemorySaver`，每次写入后把它的 `storage` / `writes` 存成 JSON 文件，启动时再读回来。

限制：每次写入都重写整个文件，没有并发保护，只适合本地单进程演示。每个 checkpoint 存一份完整状态，文件涨得很快：一次两轮的排障对话大约 400 KB，可以随时删掉 `.data/`。

Mastra 用的 LibSQL 是预编译包，不需要本地编译，所以能直接用。

## 用下来的区别

- **抽象层次**：Mastra 的 Agent、Workflow、Memory、Playground 是一整套，配置项多、开箱即用。LangChain v1 的 `createAgent` 本身就是一张 LangGraph 图，记忆、流式、Studio 都是 LangGraph 的通用能力，Agent 和 Workflow 用的是同一套底层。
- **扩展点**：Mastra 给每种需求各开一个口子（prepareStep、processors、memory options）。LangChain 统一成中间件，`wrapModelCall` 和 `wrapToolCall` 能拿到请求、也能控制要不要调、调几次。写法更自由，重试这类逻辑也要自己写。
- **类型**：LangGraph 的 `StateGraph` 会推断节点名，节点得用链式 `.addNode()` 逐个写，不能循环动态添加，否则类型对不上。状态字段名不能和节点名重名，所以报告节点叫 `reporter`。
- **工具返回值**：Mastra 有 outputSchema，返回对象。LangChain 的工具返回值直接变成 ToolMessage 文本，要自己序列化。
- **流式**：Mastra 的 `fullStream` 事件粒度细（tool-call、tool-result、text-delta）。LangGraph 按模式选：`updates` 按节点、`messages` 按 token。本项目中间件会在一次模型调用里重试，逐 token 打印会把被打回的回复也印出来，所以命令行用 `updates`，回答是整段打印的。
- **调试界面**：Playground 完全本地。LangGraph 的 Studio 界面在 LangSmith 云端，本地只跑 API 服务。
- **依赖**：持久化记忆在 Mastra 这边零成本。LangGraph 官方的 SQLite / Postgres checkpointer 要么要原生编译、要么要数据库，这里只能自己写一个文件版。
