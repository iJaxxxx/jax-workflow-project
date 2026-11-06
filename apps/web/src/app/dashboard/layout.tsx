"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

import AdminHeader from "@/components/admin-header";
import Forbidden from "@/components/forbidden";
import Loader from "@/components/loader";
import { authClient } from "@/lib/auth-client";

/**
 * The site is a static export (Cloudflare Pages), so there is no server to
 * check the session. The check runs in the browser and children only render
 * for admins. Real access control stays in the API (`protectedProcedure`).
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const { data: session, isPending } = authClient.useSession();
	const user = session?.user;

	useEffect(() => {
		if (!(isPending || user)) {
			const { search } = window.location;
			router.replace(
				`/login?redirect=${encodeURIComponent(pathname + search)}`
			);
		}
	}, [isPending, user, pathname, router]);

	if (isPending || !user) {
		return <Loader />;
	}

	if (user.role !== "admin") {
		return <Forbidden />;
	}

	return (
		<div className="flex min-h-0 flex-col">
			<AdminHeader email={user.email} name={user.name} />
			<main className="container mx-auto w-full max-w-5xl px-4 py-6">
				{children}
			</main>
		</div>
	);
}
