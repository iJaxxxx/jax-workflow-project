import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, posix, relative, sep } from "node:path";
import { findRepoRoot } from "./paths";

// LLM Wiki：apps/agent/wiki/ 下一组人工维护、互相链接的 Markdown 页面，Mastra 和 LangChain 两个 Agent 共用。
// 页面名就是去掉 .md 的相对路径，例如 errors/injected-fault。
// Agent 只能读页面、提交修改建议（写到 _proposals/），不能直接改页面，由人审核后合并。
// 目录优先取 OPS_WIKI_DIR，否则是 <仓库根>/apps/agent/wiki。
export const wikiRoot =
	process.env.OPS_WIKI_DIR ?? join(findRepoRoot(), "apps", "agent", "wiki");
export const proposalsDir = join(wikiRoot, "_proposals");

// 页面名只允许小写字母、数字、连字符，用 / 分目录，防止路径穿越（../）
const PAGE_NAME = /^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*$/;
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const SUMMARY_LINE = /^summary:\s*(.+)$/m;
const HEADING_MARK = /^#+\s*/;
const BACKSLASH = /\\/g;
const WIKI_PREFIX = /^\.?\/?(wiki\/)?/;
const MD_SUFFIX = /\.md$/;
const WORD_SEPARATOR = /[/\-\s]+/;
const SLASH = /\//g;
const MARKDOWN_LINK = /\]\(([^)#\s]+\.md)\)/g;
const TIMESTAMP_PUNCTUATION = /[:.]/g;
const MAX_MATCHES = 5;

export interface WikiPage {
	name: string;
	summary: string;
}

export function isValidPageName(name: string) {
	return PAGE_NAME.test(name);
}

// 模型可能传 "wiki/errors/injected-fault.md"、带空格或大写，先规整一下
export function normalizePageName(raw: string) {
	return raw
		.trim()
		.toLowerCase()
		.replace(BACKSLASH, "/")
		.replace(WIKI_PREFIX, "")
		.replace(MD_SUFFIX, "");
}

// 摘要优先取 front matter 的 summary，没有就取正文第一行非空文字
function extractSummary(content: string) {
	const front = content.match(FRONT_MATTER);
	const fromFront = front?.[1]?.match(SUMMARY_LINE)?.[1];
	if (fromFront) {
		return fromFront.trim();
	}
	const body = content.replace(FRONT_MATTER, "");
	const firstLine = body
		.split("\n")
		.map((line) => line.replace(HEADING_MARK, "").trim())
		.find((line) => line.length > 0);
	return firstLine ?? "";
}

// 递归列出所有 .md 文件，跳过 README.md 和以 _ 开头的目录（_proposals）
async function collectMarkdownFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const visible = entries.filter(
		(entry) => !(entry.name.startsWith("_") || entry.name.startsWith("."))
	);
	const nested = await Promise.all(
		visible.map((entry) => {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				return collectMarkdownFiles(full);
			}
			const isPage =
				entry.name.endsWith(".md") &&
				!(dir === wikiRoot && entry.name === "README.md");
			return isPage ? [full] : [];
		})
	);
	return nested.flat();
}

function pageNameOf(file: string) {
	return relative(wikiRoot, file).split(sep).join("/").replace(MD_SUFFIX, "");
}

export async function listPages(): Promise<WikiPage[]> {
	const files = await collectMarkdownFiles(wikiRoot);
	const pages = await Promise.all(
		files.map(async (file) => ({
			name: pageNameOf(file),
			summary: extractSummary(await readFile(file, "utf8")),
		}))
	);
	return pages.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readPage(name: string) {
	return await readFile(join(wikiRoot, `${name}.md`), "utf8");
}

// 页面里用相对路径链接到的其他页面名，例如 ../incidents/x.md → incidents/x
export function linkedPages(name: string, content: string) {
	const base = posix.dirname(name);
	const names = [...content.matchAll(MARKDOWN_LINK)].map((match) =>
		posix.join(base, match[1] ?? "").replace(MD_SUFFIX, "")
	);
	return [...new Set(names)].filter((linked) => linked !== name);
}

// 找名字相近的页面：按「/」和「-」切词，命中的词越多越靠前
export function closeMatches(query: string, pages: WikiPage[]) {
	const words = query.split(WORD_SEPARATOR).filter((word) => word.length > 1);
	return pages
		.map((page) => ({
			name: page.name,
			score: words.filter(
				(word) => page.name.includes(word) || page.summary.includes(word)
			).length,
		}))
		.filter((item) => item.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, MAX_MATCHES)
		.map((item) => item.name);
}

// 修改建议写成 _proposals/<时间戳>--<页面名把 / 换成 __>.md，不碰正式页面
export async function writeProposal(
	name: string,
	content: string,
	reason: string
) {
	await mkdir(proposalsDir, { recursive: true });
	const now = new Date();
	const stamp = now.toISOString().replace(TIMESTAMP_PUNCTUATION, "-");
	const file = join(proposalsDir, `${stamp}--${name.replace(SLASH, "__")}.md`);
	const exists = (await listPages()).some((page) => page.name === name);
	const header = [
		"<!--",
		"Agent 提交的 wiki 修改建议，等待人工审核（见 wiki/README.md）",
		`目标页面: ${name}.md（${exists ? "修改已有页面" : "新建页面"}）`,
		`原因: ${reason}`,
		`时间: ${now.toISOString()}`,
		"-->",
		"",
	].join("\n");
	await writeFile(file, `${header}${content.trim()}\n`, "utf8");
	// 相对 wiki 的上一级目录（apps/agent）显示，例如 wiki/_proposals/xxx.md
	return {
		exists,
		file: relative(dirname(wikiRoot), file).split(sep).join("/"),
	};
}

// 以下三个函数是三个 wiki 工具的完整行为，两边框架的工具定义只是包一层

// list-wiki-pages
export async function listWikiPages() {
	return {
		// 小模型看完列表容易直接写回答，把下一步写在结果里提醒它
		nextStep:
			"按报错原文、告警名、资源名挑最相关的 1~2 页，用 read-wiki-page 读全文。",
		pages: await listPages(),
	};
}

// read-wiki-page
export async function readWikiPage(name: string) {
	const normalized = normalizePageName(name);
	const pages = await listPages();
	if (pages.some((page) => page.name === normalized)) {
		const content = await readPage(normalized);
		return {
			content,
			found: true,
			// 这页链接到的其他页面。参考里要引用它们，得先用 read-wiki-page 读过
			links: linkedPages(normalized, content),
			name: normalized,
		};
	}
	// 名字不对时不抛错，把相近的页面名（没有就给全部页面名）告诉模型，让它换个名字再读
	const matches = closeMatches(normalized, pages);
	const candidates =
		matches.length > 0 ? matches : pages.map((page) => page.name);
	return {
		content: `没有名为「${name}」的页面。可用的页面名：${candidates.join("、")}。请用其中一个重新调用 read-wiki-page。`,
		found: false,
		links: [] as string[],
		name: normalized,
	};
}

// propose-wiki-update：只写修改建议，不改正式页面（见 wiki/README.md）
export async function proposeWikiUpdate(input: {
	content: string;
	name: string;
	reason: string;
}) {
	const normalized = normalizePageName(input.name);
	if (!isValidPageName(normalized)) {
		return {
			message: `页面名「${input.name}」不合法：只能用小写字母、数字、连字符，用 / 分目录，例如 errors/new-error。`,
			ok: false,
		};
	}
	const { exists, file } = await writeProposal(
		normalized,
		input.content,
		input.reason
	);
	return {
		message: `已提交${exists ? "修改" : "新建"}页面 ${normalized} 的建议，保存在 ${file}，等待人工审核。wiki 本身还没有改动。`,
		ok: true,
	};
}
