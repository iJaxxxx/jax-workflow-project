#!/bin/sh
# Claude Code PreToolUse hook：拦截 git commit，类型检查和代码风格检查不过就不让提交。
# 退出码 2 = 阻止这次工具调用，stderr 会回给 Claude。只回关键报错，不回完整日志。
set -u

command=$(jq -r '.tool_input.command // ""')
# 只认真正执行的 git commit（命令开头或 && ; | 之后），不管字符串里提到的
if ! printf '%s\n' "$command" | grep -q -E '(^|[;&|(])[[:space:]]*git[[:space:]]+(-C[[:space:]]+[^[:space:]]+[[:space:]]+)?commit([[:space:]]|$)'; then
	exit 0
fi

cd "$(git rev-parse --show-toplevel)" || exit 0

run_gate() {
	name=$1
	shift
	if ! output=$("$@" 2>&1); then
		# tsc 的报错行带 error；Biome 的报错头是 "路径:行:列 lint/规则"，下一行是说明；
		# 工具本身起不来时（例如 Node 版本太低）保留 XxxError 和 Node.js 版本行
		errors=$(printf '%s\n' "$output" | grep -E -A2 'error TS|^\S+:[0-9]+:[0-9]+ |✖|[A-Za-z]+Error:|^Node\.js v|failed' | grep -v -i 'warning' | head -40)
		[ -z "$errors" ] && errors=$(printf '%s\n' "$output" | tail -30)
		printf '提交被拦截：%s 没通过。先修好再提交（风格问题可以先 pnpm fix）。\n%s\n' "$name" "$errors" >&2
		exit 2
	fi
}

run_gate "pnpm check-types" pnpm check-types
run_gate "pnpm check" pnpm check
exit 0
