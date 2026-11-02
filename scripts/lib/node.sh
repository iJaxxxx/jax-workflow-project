# 被 dev.sh、acceptance.sh 和两个 hook 引用：保证用的是 Node ≥ 20。
# Claude Code 进程可能还带着启动时的旧 PATH（例如 Node 18），这时把 Homebrew 的 node@22（或 $JAX_NODE_BIN）放到 PATH 最前面。

node_major() {
	node -p 'process.versions.node.split(".")[0]' </dev/null 2>/dev/null || echo 0
}

if [ "$(node_major)" -lt 20 ]; then
	for node_dir in "${JAX_NODE_BIN:-}" /opt/homebrew/opt/node@22/bin /opt/homebrew/opt/node@20/bin; do
		if [ -n "$node_dir" ] && [ -x "$node_dir/node" ]; then
			PATH="$node_dir:$PATH"
			export PATH
			break
		fi
	done
	if [ "$(node_major)" -lt 20 ]; then
		echo "需要 Node 20 以上（当前 $(node -v 2>/dev/null || echo 未安装)）：装 node@22，或用 JAX_NODE_BIN 指定它的 bin 目录" >&2
		exit 2
	fi
fi
