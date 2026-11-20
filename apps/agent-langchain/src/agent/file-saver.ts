import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { RunnableConfig } from "@langchain/core/runnables";
import {
	type Checkpoint,
	type CheckpointMetadata,
	MemorySaver,
	type PendingWrite,
} from "@langchain/langgraph-checkpoint";

// 能落盘的 checkpointer：在 LangGraph 自带的 MemorySaver 上加「每次写入后存成 JSON 文件、启动时读回来」。
// 为什么不用官方的 @langchain/langgraph-checkpoint-sqlite：它依赖 better-sqlite3（原生编译模块），
// 本仓库 pnpm-workspace.yaml 的 allowBuilds 不允许它跑编译脚本。
// Mastra 那边的 LibSQLStore 用的是 libsql 的预编译包，不需要本地编译，所以能直接用。
// 这个实现只适合本地单进程演示：每次写入都重写整个文件，没有并发保护。

// MemorySaver 里存的是序列化后的 Uint8Array，JSON 里用 base64 表示
const BYTES_TAG = "__bytes";

function replacer(_key: string, value: unknown) {
	if (value instanceof Uint8Array) {
		return { [BYTES_TAG]: Buffer.from(value).toString("base64") };
	}
	return value;
}

function reviver(_key: string, value: unknown) {
	if (
		value &&
		typeof value === "object" &&
		BYTES_TAG in value &&
		typeof value[BYTES_TAG] === "string"
	) {
		return new Uint8Array(Buffer.from(value[BYTES_TAG], "base64"));
	}
	return value;
}

export class JsonFileSaver extends MemorySaver {
	private readonly file: string;

	constructor(file: string) {
		super();
		this.file = file;
		if (existsSync(file)) {
			const saved = JSON.parse(readFileSync(file, "utf8"), reviver) as {
				storage: MemorySaver["storage"];
				writes: MemorySaver["writes"];
			};
			this.storage = saved.storage;
			this.writes = saved.writes;
		}
	}

	private persist() {
		mkdirSync(dirname(this.file), { recursive: true });
		writeFileSync(
			this.file,
			JSON.stringify({ storage: this.storage, writes: this.writes }, replacer)
		);
	}

	override async put(
		config: RunnableConfig,
		checkpoint: Checkpoint,
		metadata: CheckpointMetadata
	) {
		const result = await super.put(config, checkpoint, metadata);
		this.persist();
		return result;
	}

	override async putWrites(
		config: RunnableConfig,
		writes: PendingWrite[],
		taskId: string,
		taskPath?: string
	) {
		await super.putWrites(config, writes, taskId, taskPath);
		this.persist();
	}

	override async deleteThread(threadId: string) {
		await super.deleteThread(threadId);
		this.persist();
	}
}
