#!/bin/sh
# 按 requirements.md 的验收标准跑验收，结果由脚本写回 AC 的勾选状态，不靠人工判断。
#
#   scripts/acceptance.sh <模块名>            检查 → 跑 e2e → 回写勾选
#   scripts/acceptance.sh <模块名> --check    只检查每条 AC 都写了验证方式（拆需求时用，这时还没有测试）
#
# AC 的写法：- [ ] AC1：给定……那么…… | 验证: e2e
#           - [ ] AC7：…… | 验证: 人工（原因）
# 验证: e2e 的 AC 必须在 e2e/<模块名>.spec.ts 里有一个标题以 "AC1 " 开头的测试。
# 文件里其他测试（例如评审时写的 R- 复现测试）也必须通过。
# 退出码：0 全部通过；1 有 AC 没通过；2 AC 写法或测试缺失；3 dev 服务没起来。
set -eu

cd "$(dirname "$0")/.."
module="${1:?用法: scripts/acceptance.sh <模块名> [--check]}"
requirements="specs/$module/requirements.md"
spec="e2e/$module.spec.ts"
[ -f "$requirements" ] || {
	echo "找不到 $requirements" >&2
	exit 2
}

ac_lines=$(grep -E '^- \[[ x]\] AC[0-9]+' "$requirements" || true)
[ -n "$ac_lines" ] || {
	echo "$requirements 里没有验收标准" >&2
	exit 2
}

check_only=false
[ "${2:-}" = "--check" ] && check_only=true

problems=""
e2e_ids=""
manual_ids=""
ids=$(printf '%s\n' "$ac_lines" | sed -E 's/^- \[[ x]\] (AC[0-9]+).*/\1/')
for id in $ids; do
	line=$(printf '%s\n' "$ac_lines" | grep -E "^- \[[ x]\] ${id}[^0-9]")
	case "$line" in
	*"验证: e2e"*)
		e2e_ids="$e2e_ids $id"
		if ! $check_only && ! grep -q -E "test\([\"'\`]${id} " "$spec" 2>/dev/null; then
			problems="${problems}${id}：标了 e2e，但 $spec 里没有标题以 \"${id} \" 开头的测试\n"
		fi
		;;
	*"验证: 人工"*) manual_ids="$manual_ids $id" ;;
	*) problems="${problems}${id}：没写验证方式（行尾加 | 验证: e2e 或 | 验证: 人工（原因））\n" ;;
	esac
done

if [ -n "$problems" ]; then
	printf '验收标准不完整：\n%b' "$problems" >&2
	exit 2
fi

if $check_only; then
	echo "验收标准都写了验证方式：e2e${e2e_ids:- 无}；人工${manual_ids:- 无}"
	exit 0
fi

if [ -n "$e2e_ids" ]; then
	if ! nc -z localhost 3000 >/dev/null 2>&1 || ! nc -z localhost 3001 >/dev/null 2>&1; then
		echo "dev 服务没起来，先执行 scripts/dev.sh up" >&2
		exit 3
	fi

	report=$(mktemp)
	PLAYWRIGHT_JSON_OUTPUT_NAME="$report" pnpm exec playwright test "$spec" --reporter=json,list || true
	if [ ! -s "$report" ]; then
		echo "Playwright 没有产出结果（见上面的输出）" >&2
		rm -f "$report"
		exit 1
	fi
	results=$(jq -r '[.. | objects | select(has("specs")) | .specs[]] | .[] | "\(.title | split(" ")[0]) \(.ok)"' "$report")
	rm -f "$report"

	# 不对应 AC 的测试（R- 复现测试等）
	failed=$(printf '%s\n' "$results" | awk '$1 !~ /^AC[0-9]+$/ && $2 == "false" { printf " %s", $1 }')
	for id in $e2e_ids; do
		# 同一条 AC 可以有多个测试，全部通过才算通过
		statuses=$(printf '%s\n' "$results" | awk -v id="$id" '$1 == id { print $2 }')
		if [ -n "$statuses" ] && ! printf '%s\n' "$statuses" | grep -q false; then
			perl -i -pe "s/^- \\[ \\] (${id}[^0-9])/- [x] \$1/" "$requirements"
		else
			perl -i -pe "s/^- \\[x\\] (${id}[^0-9])/- [ ] \$1/" "$requirements"
			failed="$failed $id"
		fi
	done

	if [ -n "$failed" ]; then
		echo "验收没通过：${failed}（失败详情见上面的测试输出）" >&2
		exit 1
	fi
	echo "e2e 验收全部通过：${e2e_ids}"
fi

if [ -n "$manual_ids" ]; then
	echo "需要人工验证（用浏览器验证后手动勾选，并在汇报里说明）：${manual_ids}"
fi
