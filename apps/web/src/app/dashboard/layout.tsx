import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import AdminHeader from "@/components/admin-header";
import Forbidden from "@/components/forbidden";
import { getSession } from "@/lib/admin-session";

export default async function DashboardLayout({
	children,
}: {
	children: ReactNode;
}) {
	const session = await getSession();

	if (!session?.user) {
		redirect("/login");
	}

	if (session.user.role !== "admin") {
		return <Forbidden />;
	}

	return (
		<div className="flex min-h-0 flex-col">
			<AdminHeader email={session.user.email} name={session.user.name} />
			<main className="container mx-auto w-full max-w-5xl px-4 py-6">
				{children}
			</main>
		</div>
	);
}
