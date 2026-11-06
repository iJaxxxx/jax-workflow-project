"use client";

import { Suspense } from "react";

import Loader from "@/components/loader";
import { authClient } from "@/lib/auth-client";

import UsersTable from "./users-table";

export default function UsersPage() {
	// The dashboard layout only renders children once an admin session is loaded.
	const { data: session } = authClient.useSession();
	if (!session) {
		return null;
	}

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="font-semibold text-2xl">用户管理</h1>
				<p className="text-muted-foreground text-sm">
					查看和搜索所有注册用户，禁用或启用账号。
				</p>
			</div>
			<Suspense fallback={<Loader />}>
				<UsersTable currentUserId={session.user.id} />
			</Suspense>
		</div>
	);
}
