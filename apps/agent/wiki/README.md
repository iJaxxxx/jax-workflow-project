# 运维 Wiki

给运维助手（`src/mastra/agents/ops-agent.ts`）读的知识库：系统架构、服务说明、已知报错、历史事故。人来维护，Agent 读取并提出修改建议。

## 目录

- `architecture/`：系统架构、请求链路
- `services/`：各个服务的接口、日志、部署方式
- `errors/`：已知报错，按症状查
- `incidents/`：历史事故复盘，文件名 `YYYY-MM-DD-简述.md`
- `_proposals/`：Agent 提交的修改建议，等待人工审核（不进 Git）

## 页面格式

页面名就是去掉 `.md` 的相对路径，例如 `errors/injected-fault`。文件名只用小写字母、数字、连字符。
每页开头写 front matter，`summary` 是一句话摘要，Agent 列页面时只看到页面名和这句摘要：

```markdown
---
summary: 一句话说明这页讲什么，带上关键报错或资源名
---

# 标题
```

页面之间用相对路径的 Markdown 链接互相引用，例如 `[请求链路](../architecture/request-chain.md)`。

## 审核 Agent 的修改建议

Agent 不会直接改页面，只会调用 `propose-wiki-update` 在 `_proposals/` 下写一个文件，
文件名是 `<时间戳>--<页面名，/ 换成 __>.md`，开头的注释写了目标页面、原因和时间。

1. 打开 `_proposals/` 里的文件，核对内容是否属实。
2. 采纳：
   - 新建页面：删掉开头的注释，把文件移到目标路径，例如 `mv _proposals/2026-...--errors__new-error.md errors/new-error.md`。
   - 修改已有页面：把有用的内容手动合并进目标页面，再删除建议文件。
3. 不采纳：直接删除建议文件。
4. 补上与其他页面的互相链接，提交 Git。
