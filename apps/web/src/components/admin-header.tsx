"use client";

import { Button } from "@jax-workflow-project/ui/components/button";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

const NAV_LINKS: { href: Route; label: string }[] = [
	{ href: "/dashboard/users" as Route, label: "用户管理" },
	{ href: "/dashboard/logs" as Route, label: "操作日志" },
];

interface AdminHeaderProps {
	email: string;
	name: string;
}

export default function AdminHeader({ email, name }: AdminHeaderProps) {
	const router = useRouter();

	const handleSignOut = () => {
		authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					router.push("/login");
				},
			},
		});
	};

	return (
		<header className="border-b">
			<div className="container mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
				<div className="flex items-center gap-6">
					<Link className="font-semibold" href="/dashboard">
						后台管理
					</Link>
					<nav className="flex gap-4 text-sm">
						{NAV_LINKS.map((link) => (
							<Link
								className="text-muted-foreground hover:text-foreground"
								href={link.href}
								key={link.href}
							>
								{link.label}
							</Link>
						))}
					</nav>
				</div>
				<div className="flex items-center gap-3">
					<div className="flex flex-col text-right text-xs">
						<span className="font-medium">{name}</span>
						<span className="text-muted-foreground">{email}</span>
					</div>
					<Button onClick={handleSignOut} variant="outline">
						退出
					</Button>
				</div>
			</div>
		</header>
	);
}
