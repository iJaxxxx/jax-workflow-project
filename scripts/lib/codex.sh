# 被 codex-review.sh、codex-spec-review.sh 引用：找到 codex 并确认已登录，结果放在 $codex_bin。
#
# 查找 codex 的顺序：$CODEX_BIN → PATH → Codex 桌面版自带的 CLI。
# 模型默认 gpt-6-luna（ChatGPT 账号可用），可用 $CODEX_MODEL 覆盖；不改 ~/.codex/config.toml。

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
