import { Suspense } from "react";

import Loader from "@/components/loader";

import LogsTable from "./logs-table";

export default function LogsPage() {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="font-semibold text-2xl">操作日志</h1>
				<p className="text-muted-foreground text-sm">
					管理员禁用 / 启用用户的记录，按时间倒序排列，只能查看。
				</p>
			</div>
			<Suspense fallback={<Loader />}>
				<LogsTable />
			</Suspense>
		</div>
	);
}
