import { headers } from "next/headers";
import { cache } from "react";

import { authClient } from "@/lib/auth-client";

/**
 * Server-only session lookup, deduplicated per request.
 * The dashboard layout does not stop child pages from rendering, so every
 * dashboard page (and any server-side data fetching) must call
 * `getAdminSession()` itself and bail out when it returns null.
 */
export const getSession = cache(
	async () =>
		await authClient.getSession({
			fetchOptions: {
				headers: await headers(),
				throw: true,
			},
		})
);

export const getAdminSession = cache(async () => {
	const session = await getSession();
	return session?.user.role === "admin" ? session : null;
});
