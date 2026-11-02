#!/bin/sh
# 验收测试用的开发环境。
#
#   scripts/dev.sh up       检查数据库 → db:push → 后台启动 pnpm dev → 等 3000、3001 就绪
#   scripts/dev.sh down     停掉 dev 服务
#   scripts/dev.sh status   看服务是否在跑
#
# 日志在 .dev/dev.log。数据库连不上就退出，不改 .env。
set -eu

cd "$(dirname "$0")/.."
. scripts/lib/node.sh
state_dir=.dev
pid_file=$state_dir/dev.pid
log_file=$state_dir/dev.log
ports="3000 3001"
wait_seconds=180

port_open() {
	nc -z localhost "$1" >/dev/null 2>&1
}

check_database() {
	url=$(sed -n 's/^DATABASE_URL=//p' apps/server/.env 2>/dev/null | tr -d '"' | head -1)
	if [ -z "$url" ]; then
		echo "apps/server/.env 里没有 DATABASE_URL" >&2
		exit 2
	fi
	host_port=$(printf '%s' "$url" | sed -E 's#^[^@]*@([^/?]+).*#\1#')
	host=${host_port%%:*}
	port=${host_port##*:}
	[ "$port" = "$host_port" ] && port=5432
	if ! nc -z "$host" "$port" >/dev/null 2>&1; then
		echo "数据库连不上：${host}:${port}。先把 PostgreSQL 启动起来" >&2
		exit 2
	fi
}

up() {
	if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
		echo "dev 服务已经在跑（pid $(cat "$pid_file")）"
		return
	fi
	check_database
	if ! push_output=$(pnpm db:push 2>&1); then
		printf 'pnpm db:push 失败：\n%s\n' "$(printf '%s\n' "$push_output" | tail -20)" >&2
		exit 2
	fi
	mkdir -p "$state_dir"
	nohup pnpm dev >"$log_file" 2>&1 &
	echo $! >"$pid_file"

	elapsed=0
	for port in $ports; do
		until port_open "$port"; do
			if [ "$elapsed" -ge "$wait_seconds" ]; then
				echo "等了 ${wait_seconds} 秒端口 ${port} 还没起来，最后的日志：" >&2
				tail -30 "$log_file" >&2
				down
				exit 3
			fi
			sleep 2
			elapsed=$((elapsed + 2))
		done
	done
	echo "dev 服务已就绪：server http://localhost:3000，web http://localhost:3001"
}

down() {
	if [ -f "$pid_file" ]; then
		pid=$(cat "$pid_file")
		pkill -P "$pid" 2>/dev/null || true
		kill "$pid" 2>/dev/null || true
		rm -f "$pid_file"
	fi
	for port in $ports; do
		lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null || true
	done
	echo "dev 服务已停止"
}

status() {
	for port in $ports; do
		if port_open "$port"; then echo "$port 在运行"; else echo "$port 未运行"; fi
	done
}

case "${1:-}" in
up) up ;;
down) down ;;
status) status ;;
*)
	echo "用法: scripts/dev.sh up | down | status" >&2
	exit 1
	;;
esac
