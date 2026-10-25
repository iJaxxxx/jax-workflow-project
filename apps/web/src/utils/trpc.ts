import type { AppRouter } from "@jax-workflow-project/api/routers/index";
import {
	environmentManager,
	MutationCache,
	QueryCache,
	QueryClient,
} from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { toast } from "sonner";

const TRAILING_SLASH = /\/$/;
const LOGIN_PATH = "/login";

function isUnauthorized(error: unknown): boolean {
	return (
		error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED"
	);
}

/** Returns true when the error was handled by redirecting to the login page. */
function redirectToLoginIfUnauthorized(error: unknown): boolean {
	if (!isUnauthorized(error)) {
		return false;
	}
	if (typeof window === "undefined") {
		return true;
	}
	const { pathname, search } = window.location;
	if (pathname !== LOGIN_PATH) {
		window.location.href = `${LOGIN_PATH}?redirect=${encodeURIComponent(pathname + search)}`;
	}
	return true;
}

export const { TRPCProvider, useTRPC, useTRPCClient } =
	createTRPCContext<AppRouter>();

function makeQueryClient() {
	return new QueryClient({
		mutationCache: new MutationCache({
			onError: (error) => {
				redirectToLoginIfUnauthorized(error);
			},
		}),
		queryCache: new QueryCache({
			onError: (error, query) => {
				if (redirectToLoginIfUnauthorized(error)) {
					return;
				}
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
