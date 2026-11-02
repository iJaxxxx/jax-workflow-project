#!/bin/sh
# Claude Code PostToolUse hook：格式化刚编辑的文件。ultracite 从 stdin 读出被编辑的文件，只修这一个文件。
cd "$(dirname "$0")/../.." || exit 0
. scripts/lib/node.sh
exec pnpm exec ultracite fix --skip=correctness/noUnusedImports --hook
