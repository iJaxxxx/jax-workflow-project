import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@jax-workflow-project/ui/components/card";
import type { Route } from "next";
import Link from "next/link";

const ADMIN_ENTRIES: { description: string; href: Route; title: string }[] = [
	{
		description: "查看、搜索和管理系统中的用户",
		href: "/dashboard/users" as Route,
		title: "用户管理",
	},
	{
		description: "查看管理员的操作记录",
		href: "/dashboard/logs" as Route,
		title: "操作日志",
	},
];

export default function DashboardPage() {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="font-semibold text-2xl">后台首页</h1>
				<p className="text-muted-foreground text-sm">
					欢迎使用后台管理系统，请选择要进入的模块。
				</p>
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				{ADMIN_ENTRIES.map((entry) => (
					<Link href={entry.href} key={entry.href}>
						<Card className="h-full transition-colors hover:bg-muted">
							<CardHeader>
								<CardTitle>{entry.title}</CardTitle>
								<CardDescription>{entry.description}</CardDescription>
							</CardHeader>
						</Card>
					</Link>
				))}
			</div>
		</div>
	);
}
