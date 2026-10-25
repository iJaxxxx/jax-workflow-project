import type { AppRouter } from "@jax-workflow-project/api/routers/index";
import {
	environmentManager,
	QueryCache,
	QueryClient,
} from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { toast } from "sonner";

const TRAILING_SLASH = /\/$/;

export const { TRPCProvider, useTRPC, useTRPCClient } =
	createTRPCContext<AppRouter>();

function makeQueryClient() {
	return new QueryClient({
		queryCache: new QueryCache({
			onError: (error, query) => {
				toast.error(error.message, {
					action: {
						label: "retry",
						onClick: () => {
							query.invalidate();
						},
					},
				});
			},
		}),
	});
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
	if (environmentManager.isServer()) {
		return makeQueryClient();
	}

	browserQueryClient ??= makeQueryClient();
	return browserQueryClient;
}

export function makeTRPCClient() {
	return createTRPCClient<AppRouter>({
		links: [
			httpBatchLink({
				fetch: (input, options) =>
					fetch(input, {
						...options,
						credentials: "include",
					}),
				// biome-ignore lint/style/noNonNullAssertion: required by .env.schema, inlined by Next at build time
				url: `${process.env.NEXT_PUBLIC_SERVER_URL!.replace(TRAILING_SLASH, "")}/trpc`,
			}),
		],
	});
}
