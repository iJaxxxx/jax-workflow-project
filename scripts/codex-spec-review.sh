#!/bin/sh
# 开发前用 Codex 审 specs：PRD 的功能点有没有漏，每条验收标准能不能验证。只读，不改文件。
#
#   scripts/codex-spec-review.sh <PRD 路径> [模块名…]   不给模块名就审 specs/ 下所有模块
set -eu

. "$(dirname "$0")/lib/codex.sh"

prd="${1:?用法: scripts/codex-spec-review.sh <PRD 路径> [模块名…]}"
shift
[ -f "$prd" ] || {
	echo "PRD 不存在：$prd" >&2
	exit 4
}

if [ $# -eq 0 ]; then
	set -- $(ls specs | grep -E '^[0-9]{2}-')
fi
files=""
for module in "$@"; do
	files="$files specs/$module/requirements.md specs/$module/design.md"
done

prompt=$(
	cat <<PROMPT
你是这个项目的需求评审。只读文件，不要修改任何文件。

PRD：$prd
specs：$files

逐项检查，输出中文：
1. 遗漏：PRD 里的功能点，在 requirements.md 的验收标准里找不到对应的，逐条列出（引用 PRD 原文）
2. 不可验证：验收标准没写"验证:"，或者写了但按它没法得出通过 / 不通过的，逐条列出并给出改法
3. 超范围：验收标准里有 PRD 没要求、也不在"不做的事"里的，逐条列出
4. 设计冲突：design.md 和 requirements.md 对不上的地方

每条前面标 [必须改] 或 [建议]。没有问题的类别写"无"。最后一行只写：结论: 通过 或 结论: 需要修改
PROMPT
)

exec "$codex_bin" exec -c "model=\"${CODEX_MODEL}\"" -s read-only "$prompt"
