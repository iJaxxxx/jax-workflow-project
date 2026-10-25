"use client";

import { Button } from "@jax-workflow-project/ui/components/button";
import {
	Empty,
	EmptyHeader,
	EmptyTitle,
} from "@jax-workflow-project/ui/components/empty";
import { Label } from "@jax-workflow-project/ui/components/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@jax-workflow-project/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import Loader from "@/components/loader";
import { useTRPC } from "@/utils/trpc";

const ACTION_LABELS = {
	USER_BAN: "禁用用户",
	USER_UNBAN: "启用用户",
} as const;

type Action = keyof typeof ACTION_LABELS;

function parseAction(value: string | null): Action | undefined {
	return value === "USER_BAN" || value === "USER_UNBAN" ? value : undefined;
}

function parsePage(value: string | null): number {
	const page = Number(value);
	return Number.isInteger(page) && page >= 1 ? page : 1;
}

function formatDateTime(value: Date | string): string {
	const date = new Date(value);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatUser(user: { email: string; name: string }): string {
	return `${user.name}（${user.email}）`;
}

export default function LogsTable() {
	const trpc = useTRPC();
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const page = parsePage(searchParams.get("page"));
	const action = parseAction(searchParams.get("action"));

	const updateUrl = (next: { action?: Action | null; page: number }) => {
		const params = new URLSearchParams(searchParams);
		const nextAction = next.action === undefined ? action : next.action;
		if (nextAction) {
			params.set("action", nextAction);
		} else {
			params.delete("action");
		}
		params.set("page", String(next.page));
		router.replace(`${pathname}?${params.toString()}` as Route);
	};

	const listQuery = useQuery(
		trpc.operationLog.list.queryOptions({ action, page })
	);
	const { data } = listQuery;
	const isEmpty = data !== undefined && data.items.length === 0;
	const totalPages = data
		? Math.max(1, Math.ceil(data.total / data.pageSize))
		: 1;

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center gap-2">
				<Label htmlFor="action-filter">操作类型</Label>
				<select
					className="h-8 border border-input bg-transparent px-2 text-sm"
					id="action-filter"
					onChange={(e) =>
						updateUrl({ action: parseAction(e.target.value) ?? null, page: 1 })
					}
					value={action ?? ""}
				>
					<option value="">全部</option>
					<option value="USER_BAN">{ACTION_LABELS.USER_BAN}</option>
					<option value="USER_UNBAN">{ACTION_LABELS.USER_UNBAN}</option>
				</select>
			</div>

			{listQuery.status === "pending" ? <Loader /> : null}

			{isEmpty ? (
				<Empty>
					<EmptyHeader>
						<EmptyTitle>暂无操作日志</EmptyTitle>
					</EmptyHeader>
					{page > 1 ? (
						<Button onClick={() => updateUrl({ page: 1 })} variant="outline">
							回到第 1 页
						</Button>
					) : null}
				</Empty>
			) : null}

			{data && data.items.length > 0 ? (
				<>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>操作时间</TableHead>
								<TableHead>操作人</TableHead>
								<TableHead>操作类型</TableHead>
								<TableHead>操作对象</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.items.map((log) => (
								<TableRow key={log.id}>
									<TableCell>{formatDateTime(log.createdAt)}</TableCell>
									<TableCell>{formatUser(log.operator)}</TableCell>
									<TableCell>{ACTION_LABELS[log.action]}</TableCell>
									<TableCell>{formatUser(log.target)}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>

					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">
							共 {data.total} 条，第 {page} / {totalPages} 页
						</span>
						<div className="flex gap-2">
							<Button
								disabled={page <= 1}
								onClick={() => updateUrl({ page: page - 1 })}
								size="sm"
								variant="outline"
							>
								上一页
							</Button>
							<Button
								disabled={page >= totalPages}
								onClick={() => updateUrl({ page: page + 1 })}
								size="sm"
								variant="outline"
							>
								下一页
							</Button>
						</div>
					</div>
				</>
			) : null}
		</div>
	);
}
