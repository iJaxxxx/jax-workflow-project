#!/bin/sh
# 用 Codex CLI 评审 <base>..HEAD 的改动，复用本机 Codex 已登录的 ChatGPT 账号。
#
#   scripts/codex-review.sh --check   只检查 Codex 能不能用
#   scripts/codex-review.sh <base>    评审 <base> 之后的提交，结果输出到 stdout
#
# 找 codex、模型选择见 scripts/lib/codex.sh。
set -eu

. "$(dirname "$0")/lib/codex.sh"

if [ "${1:-}" = "--check" ]; then
	echo "Codex 可用：${codex_bin}（${login_status}）"
	exit 0
fi

base="${1:?用法: scripts/codex-review.sh <base 提交> | --check}"
if ! git rev-parse --verify --quiet "${base}^{commit}" >/dev/null; then
	echo "base 不是有效的提交：$base" >&2
	exit 4
fi

# --base 不能和自定义提示一起用，所以用 Codex 默认的评审规则（结果自带 [P0]–[P3] 优先级）
exec "$codex_bin" review -c "model=\"${CODEX_MODEL}\"" --base "$base"
