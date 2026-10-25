import type { Context as ApiContext } from "@jax-workflow-project/api/context";
import type { Context as HonoContext } from "hono";
import { auth, db } from "./services";

export interface CreateContextOptions {
	context: HonoContext;
}

export async function createContext({
	context,
}: CreateContextOptions): Promise<ApiContext> {
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});
	return {
		db,
		// Sessions are deleted when a user is banned; this is a fallback in case one survives.
		session: session?.user.banned ? null : session,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
