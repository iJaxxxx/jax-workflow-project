import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";

// 模块 05 不新增接口，唯一的"验证: api"是 AC1：apps/native 能为 iOS 和 Android 打出 JS bundle。
// 每次导出到独立的临时目录，不依赖、也不污染 apps/native 里的产物。

const ROOT = path.resolve(import.meta.dirname, "..");
const NATIVE_DIR = path.join(ROOT, "apps/native");
const EXPORT_TIMEOUT = 280_000;

interface ExpoMetadata {
	fileMetadata?: Record<string, { bundle?: string }>;
}

const exportBundle = (platform: "android" | "ios") => {
	const outputDir = mkdtempSync(
		path.join(tmpdir(), `native-export-${platform}-`)
	);
	try {
		let output = "";
		try {
			output = execFileSync(
				"pnpm",
				[
					"--filter",
					"native",
					"exec",
					"expo",
					"export",
					"--platform",
					platform,
					"--output-dir",
					outputDir,
				],
				{
					cwd: ROOT,
					encoding: "utf8",
					env: { ...process.env, CI: "1" },
					stdio: ["ignore", "pipe", "pipe"],
					timeout: EXPORT_TIMEOUT,
				}
			);
		} catch (error) {
			const e = error as { stderr?: string; stdout?: string; message: string };
			throw new Error(
				`expo export --platform ${platform} 失败：${e.message}\n${e.stdout ?? ""}\n${e.stderr ?? ""}`,
				{ cause: error }
			);
		}

		const metadataPath = path.join(outputDir, "metadata.json");
		expect(existsSync(metadataPath), `没有生成 metadata.json\n${output}`).toBe(
			true
		);
		const metadata = JSON.parse(
			readFileSync(metadataPath, "utf8")
		) as ExpoMetadata;
		const bundle = metadata.fileMetadata?.[platform]?.bundle;
		expect(bundle, `metadata.json 里没有 ${platform} 的 bundle`).toBeTruthy();
		const bundlePath = path.join(outputDir, bundle as string);
		expect(existsSync(bundlePath), `bundle 文件不存在：${bundlePath}`).toBe(
			true
		);
		expect(statSync(bundlePath).size).toBeGreaterThan(0);
	} finally {
		rmSync(outputDir, { force: true, recursive: true });
	}
};

test("AC1 expo export 为 iOS 和 Android 都能成功生成 JS bundle", () => {
	test.setTimeout(EXPORT_TIMEOUT * 2 + 20_000);
	expect(
		existsSync(path.join(NATIVE_DIR, "package.json")),
		"apps/native/package.json 不存在"
	).toBe(true);
	exportBundle("ios");
	exportBundle("android");
});
