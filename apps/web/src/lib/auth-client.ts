import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	// biome-ignore lint/style/noNonNullAssertion: required by .env.schema, inlined by Next at build time
	baseURL: process.env.NEXT_PUBLIC_SERVER_URL!,
	plugins: [
		inferAdditionalFields({
			user: {
				role: { input: false, required: false, type: ["user", "admin"] },
			},
		}),
	],
});
