import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Document } from "@langchain/core/documents";
import { MarkdownTextSplitter } from "@langchain/textsplitters";
import { EMBED_MODEL, findRepoRoot, SOURCE_DIRS } from "./config";
import { type ChunkMetadata, createEmbeddings, saveStore } from "./store";

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const FENCE_RE = /^\s*(```|~~~)/;

// 递归列出目录下所有 .md 文件
const listMarkdown = async (dir: string): Promise<string[]> => {
	if (!existsSync(dir)) {
		return [];
	}
	const entries = await readdir(dir, { recursive: true, withFileTypes: true });
	return entries
		.filter((e) => e.isFile() && e.name.endsWith(".md"))
		.map((e) => path.join(e.parentPath, e.name))
		.sort();
};

// 按标题把 Markdown 切成小节，记录 "一级 > 二级 > 三级" 标题路径，方便引用
const splitByHeading = (
	text: string,
	source: string
): Document<ChunkMetadata>[] => {
	const sections: Document<ChunkMetadata>[] = [];
	const stack: string[] = [];
	let buffer: string[] = [];
	let inFence = false;

	const flush = () => {
		const body = buffer.join("\n").trim();
		// 只有标题行、没有正文的小节不入库，免得短片段挤占 top-k
		const hasContent = buffer.some((l) => l.trim() && !HEADING_RE.test(l));
		if (body && hasContent) {
			const heading = stack.filter(Boolean).join(" > ") || undefined;
			sections.push(
				new Document<ChunkMetadata>({
					metadata: heading ? { heading, source } : { source },
					pageContent: body,
				})
			);
		}
		buffer = [];
	};

	for (const line of text.split("\n")) {
		if (FENCE_RE.test(line)) {
			inFence = !inFence;
		}
		const match = inFence ? null : HEADING_RE.exec(line);
		if (match?.[1] && match[2]) {
			flush();
			const level = match[1].length;
			stack.length = level - 1;
			stack[level - 1] = match[2];
		}
		buffer.push(line);
	}
	flush();
	return sections;
};

const main = async () => {
	const root = findRepoRoot();
	const files = (
		await Promise.all(SOURCE_DIRS.map((d) => listMarkdown(path.join(root, d))))
	).flat();
	if (files.length === 0) {
		console.error(
			`没有找到要索引的 Markdown 文件（${SOURCE_DIRS.join("、")}）`
		);
		process.exitCode = 1;
		return;
	}

	const sections = (
		await Promise.all(
			files.map(async (file) =>
				splitByHeading(await readFile(file, "utf8"), path.relative(root, file))
			)
		)
	).flat();

	// 小节过长时再用 LangChain 的 Markdown 切分器细分，metadata 会被保留
	const splitter = new MarkdownTextSplitter({
		chunkOverlap: 150,
		chunkSize: 1000,
	});
	const chunks = (await splitter.splitDocuments(sections)).map((chunk) => {
		// 被细分出来的后续片段可能丢了标题，把标题路径补在开头，向量才带得上上下文
		const { heading } = chunk.metadata;
		if (heading && !chunk.pageContent.trimStart().startsWith("#")) {
			chunk.pageContent = `${heading}\n\n${chunk.pageContent}`;
		}
		return chunk;
	});

	console.log(
		`读取 ${files.length} 个文件，切成 ${chunks.length} 个片段，开始用 ${EMBED_MODEL} 计算向量…`
	);
	const store = await MemoryVectorStore.fromDocuments(
		chunks,
		createEmbeddings()
	);
	const out = await saveStore(store);
	console.log(`索引已写入 ${path.relative(root, out) || out}`);
	for (const file of files) {
		console.log(`  - ${path.relative(root, file)}`);
	}
};

main().catch((error: unknown) => {
	console.error(
		"建立索引失败：",
		error instanceof Error ? error.message : error
	);
	console.error(
		`请确认 Ollama 已启动，并已执行 \`ollama pull ${EMBED_MODEL}\`。`
	);
	process.exitCode = 1;
});
