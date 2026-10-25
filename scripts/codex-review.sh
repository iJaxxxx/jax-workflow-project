#!/bin/sh
# 用 Codex CLI 评审 <base>..HEAD 的改动，复用本机 Codex 已登录的 ChatGPT 账号。
#
#   scripts/codex-review.sh --check   只检查 Codex 能不能用
#   scripts/codex-review.sh <base>    评审 <base> 之后的提交，结果输出到 stdout
#
# 查找 codex 的顺序：$CODEX_BIN → PATH → Codex 桌面版自带的 CLI。
# 模型默认 gpt-6-luna（ChatGPT 账号可用），可用 $CODEX_MODEL 覆盖；不改 ~/.codex/config.toml。
set -eu

CODEX_MODEL="${CODEX_MODEL:-gpt-6-luna}"
BUNDLED_CODEX="$HOME/.codex/plugins/.plugin-appserver/codex-cli/bin/codex"

find_codex() {
	if [ -n "${CODEX_BIN:-}" ] && [ -x "$CODEX_BIN" ]; then
		echo "$CODEX_BIN"
	elif command -v codex >/dev/null 2>&1; then
		command -v codex
	elif [ -x "$BUNDLED_CODEX" ]; then
		echo "$BUNDLED_CODEX"
	else
		return 1
	fi
}

if ! codex_bin=$(find_codex); then
	echo "Codex 不可用：没找到 codex 命令。装 Codex 桌面版，或执行 npm install -g @openai/codex" >&2
	exit 2
fi

login_status=$("$codex_bin" login status 2>&1 || true)
case "$login_status" in
Logged\ in*) ;;
*)
	echo "Codex 不可用：没有登录（${login_status}）。在终端执行 ${codex_bin} login，用 ChatGPT 账号登录" >&2
	exit 3
	;;
esac

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
