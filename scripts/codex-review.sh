#!/bin/sh
# 用 Codex CLI 评审 <base> 之后 packages/、apps/ 的改动（包括没提交、还没被 git 跟踪的新文件），
# 复用本机 Codex 已登录的 ChatGPT 账号。
#
#   scripts/codex-review.sh --check   只检查 Codex 能不能用
#   scripts/codex-review.sh <base>    评审 <base> 到当前工作区的业务代码改动，结果输出到 stdout
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

# Workflow 在提交之前就评审，agent 新建的文件还没被跟踪；codex review --base 只看 git diff <base>，看不到它们。
# 所以用临时 index 把"base + 工作区里 packages/、apps/ 的当前内容"拼成一个快照提交，评审这个提交。
# 不动真实的 index、HEAD 和工作区；e2e/ 正在被测试 agent 改，工具链改动也不属于模块，都不放进来。
tmp_index=$(mktemp)
GIT_INDEX_FILE=$tmp_index git read-tree "$base"
GIT_INDEX_FILE=$tmp_index git add -A -- packages apps
tree=$(GIT_INDEX_FILE=$tmp_index git write-tree)
rm -f "$tmp_index"
if [ "$tree" = "$(git rev-parse "${base}^{tree}")" ]; then
	echo "packages/、apps/ 相对 $base 没有改动，没什么可评审" >&2
	exit 5
fi
snapshot=$(git commit-tree "$tree" -p "$base" -m "codex review: $base 之后的业务代码改动")

# 不能和自定义提示一起用，所以用 Codex 默认的评审规则（结果自带 [P0]–[P3] 优先级）
exec "$codex_bin" review -c "model=\"${CODEX_MODEL}\"" --commit "$snapshot"
