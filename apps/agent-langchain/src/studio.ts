// LangGraph Studio / `langgraph dev` 的入口（见 ../langgraph.json），相当于 Mastra 的 src/mastra/index.ts。
// Studio 的服务端自带 checkpointer（线程、运行记录存在 .langgraph_api/ 下），所以这里不传 checkpointer。
import { createOpsAgent } from "./agent/ops-agent";

export const opsAgent = createOpsAgent();

// biome-ignore lint/performance/noBarrelFile: langgraph.json 需要从一个入口文件里按名字取图
export { opsDiagnosis } from "./graph/ops-diagnosis";
