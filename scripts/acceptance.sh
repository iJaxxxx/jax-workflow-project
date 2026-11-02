#!/bin/sh
# 按 requirements.md 的验收标准跑验收，结果由脚本判定，不靠人工判断。
#
#   scripts/acceptance.sh <模块名> --check        只检查每条 AC 都写了验证方式（拆需求时用，这时还没有测试）
#   scripts/acceptance.sh <模块名> --layer api    只跑后端测试 e2e/<模块名>.api.spec.ts，不改勾选（可以和 ui 同时跑）
#   scripts/acceptance.sh <模块名> --layer ui     只跑前端测试 e2e/<模块名>.ui.spec.ts，不改勾选
#   scripts/acceptance.sh <模块名>                总测试：两层串行全跑，把通过的 AC 勾上、没通过的取消勾选
#
# AC 的写法：- [ ] AC1：给定……那么…… | 验证: api      （后端测试：请求接口）
#           - [ ] AC2：…… | 验证: ui                    （前端测试：浏览器操作页面）
#           - [ ] AC7：…… | 验证: 人工（原因）
# 每条 api / ui 的 AC 必须在对应的 spec 文件里有一个标题以 "AC1 " 开头的测试；
# 文件里其他测试（例如评审时写的 R- 复现测试）也必须通过。
# 退出码：0 全部通过；1 有测试没通过；2 AC 写法或测试缺失；3 dev 服务没起来。
set -eu

cd "$(dirname "$0")/.."
. scripts/lib/node.sh
module="${1:?用法: scripts/acceptance.sh <模块名> [--check | --layer api|ui]}"
mode=all
case "${2:-}" in
"") ;;
--check) mode=check ;;
--layer)
	mode="${3:?--layer 后面要写 api 或 ui}"
	case "$mode" in api | ui) ;; *)
		echo "--layer 只能是 api 或 ui" >&2
		exit 2
		;;
	esac
	;;
*)
	echo "不认识的参数：$2" >&2
	exit 2
	;;
esac

requirements="specs/$module/requirements.md"
[ -f "$requirements" ] || {
	echo "找不到 $requirements" >&2
	exit 2
}
ac_lines=$(grep -E '^- \[[ x]\] AC[0-9]+' "$requirements" || true)
[ -n "$ac_lines" ] || {
	echo "$requirements 里没有验收标准" >&2
	exit 2
}

spec_of() { echo "e2e/$module.$1.spec.ts"; }

problems=""
api_ids=""
ui_ids=""
manual_ids=""
for id in $(printf '%s\n' "$ac_lines" | sed -E 's/^- \[[ x]\] (AC[0-9]+).*/\1/'); do
	line=$(printf '%s\n' "$ac_lines" | grep -E "^- \[[ x]\] ${id}[^0-9]")
	case "$line" in
	*"验证: api"*) layer=api ;;
	*"验证: ui"*) layer=ui ;;
	*"验证: 人工"*)
		manual_ids="$manual_ids $id"
		continue
		;;
	*)
		problems="${problems}${id}：没写验证方式（行尾加 | 验证: api、| 验证: ui 或 | 验证: 人工（原因））\n"
		continue
		;;
	esac
	if [ "$layer" = api ]; then api_ids="$api_ids $id"; else ui_ids="$ui_ids $id"; fi
	needs_test=false
	[ "$mode" = all ] && needs_test=true
	[ "$mode" = "$layer" ] && needs_test=true
	if $needs_test && ! grep -q -E "test\([\"'\`]${id} " "$(spec_of "$layer")" 2>/dev/null; then
		problems="${problems}${id}：标了 ${layer}，但 $(spec_of "$layer") 里没有标题以 \"${id} \" 开头的测试\n"
	fi
done

if [ -n "$problems" ]; then
	printf '验收标准不完整：\n%b' "$problems" >&2
	exit 2
fi

if [ "$mode" = check ]; then
	echo "验收标准都写了验证方式：api${api_ids:- 无}；ui${ui_ids:- 无}；人工${manual_ids:- 无}"
	exit 0
fi

case "$mode" in
api) ids=$api_ids layers=api ;;
ui) ids=$ui_ids layers=ui ;;
*) ids="$api_ids$ui_ids" layers="api ui" ;;
esac

if [ -n "$ids" ]; then
	if ! nc -z localhost 3000 >/dev/null 2>&1 || ! nc -z localhost 3001 >/dev/null 2>&1; then
		echo "dev 服务没起来，先执行 scripts/dev.sh up" >&2
		exit 3
	fi

	files=""
	projects=""
	for layer in $layers; do
		[ -f "$(spec_of "$layer")" ] || continue
		files="$files $(spec_of "$layer")"
		projects="$projects --project=$layer"
	done

	report=$(mktemp)
	# shellcheck disable=SC2086
	PLAYWRIGHT_JSON_OUTPUT_NAME="$report" pnpm exec playwright test $projects $files --reporter=json,list || true
	if [ ! -s "$report" ]; then
		echo "Playwright 没有产出结果（见上面的输出）" >&2
		rm -f "$report"
		exit 1
	fi
	# Playwright 的 ok 把 skip 也算通过；这里要求每次运行都真的跑了、而且预期就是通过（test.skip / test.fixme / test.fail 都算没通过）
	results=$(jq -r '[.. | objects | select(has("specs")) | .specs[]] | .[] | "\(.title | split(" ")[0]) \(.ok and ([.tests[] | .status != "skipped" and .expectedStatus == "passed"] | all))"' "$report")
	rm -f "$report"

	# 不对应 AC 的测试（R- 复现测试等）
	failed=$(printf '%s\n' "$results" | awk '$1 !~ /^AC[0-9]+$/ && $2 == "false" { printf " %s", $1 }')
	for id in $ids; do
		# 同一条 AC 可以有多个测试，全部通过才算通过
		statuses=$(printf '%s\n' "$results" | awk -v id="$id" '$1 == id { print $2 }')
		if [ -n "$statuses" ] && ! printf '%s\n' "$statuses" | grep -q false; then
			passed=true
		else
			passed=false
			failed="$failed $id"
		fi
		# 只有总测试改勾选；分层测试会同时跑，不写文件
		if [ "$mode" = all ]; then
			if $passed; then
				perl -i -pe "s/^- \\[ \\] (${id}[^0-9])/- [x] \$1/" "$requirements"
			else
				perl -i -pe "s/^- \\[x\\] (${id}[^0-9])/- [ ] \$1/" "$requirements"
			fi
		fi
	done

	if [ -n "$failed" ]; then
		echo "验收没通过（${mode}）：${failed}（失败详情见上面的测试输出）" >&2
		exit 1
	fi
	echo "验收全部通过（${mode}）：${ids}"
fi

if [ "$mode" = all ] && [ -n "$manual_ids" ]; then
	echo "需要人工验证（用浏览器验证后手动勾选，并在汇报里说明）：${manual_ids}"
fi
