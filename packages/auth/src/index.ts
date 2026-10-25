import type { Database } from "@jax-workflow-project/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";

export const BANNED_USER_MESSAGE = "账号已被禁用";

export interface AuthConfig {
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	CORS_ORIGIN: string;
}

export function createAuth(
	env: AuthConfig,
	database: Database,
	desktopOrigins: readonly string[] = []
) {
	return betterAuth({
		advanced: {
			defaultCookieAttributes: {
				httpOnly: true,
				sameSite: "none",
				secure: true,
			},
		},
		baseURL: env.BETTER_AUTH_URL,
		database: prismaAdapter(database, {
			provider: "postgresql",
		}),
		databaseHooks: {
			session: {
				create: {
					// Blocks sign-in (and any other session creation) for banned users.
					before: async (session) => {
						const user = await database.user.findUnique({
							select: { banned: true },
							where: { id: session.userId },
						});
						if (user?.banned) {
							throw new APIError("FORBIDDEN", { message: BANNED_USER_MESSAGE });
						}
						return { data: session };
					},
				},
			},
		},
		emailAndPassword: { enabled: true },
		plugins: [],
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins: [env.CORS_ORIGIN, ...desktopOrigins],
		user: {
			additionalFields: {
				banned: {
					defaultValue: false,
					input: false,
					required: false,
					type: "boolean",
				},
				role: {
					defaultValue: "user",
					input: false,
					required: false,
					type: ["user", "admin"],
				},
			},
		},
	});
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
