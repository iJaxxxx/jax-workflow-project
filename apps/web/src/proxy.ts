import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const TRAILING_SLASH = /\/+$/;

const serverUrl = (process.env.NEXT_PUBLIC_SERVER_URL ?? "").replace(
	TRAILING_SLASH,
	""
);

const hasSession = async (request: NextRequest): Promise<boolean> => {
	try {
		const response = await fetch(`${serverUrl}/api/auth/get-session`, {
			headers: { cookie: request.headers.get("cookie") ?? "" },
		});
		if (!response.ok) {
			return false;
		}
		const body: unknown = await response.json();
		return typeof body === "object" && body !== null && "user" in body
			? Boolean(body.user)
			: false;
	} catch {
		return false;
	}
};

export async function proxy(request: NextRequest) {
	if (await hasSession(request)) {
		return NextResponse.next();
	}

	const { pathname, search } = request.nextUrl;
	const loginUrl = new URL("/login", request.url);
	loginUrl.search = `?redirect=${encodeURIComponent(pathname + search)}`;
	return NextResponse.redirect(loginUrl);
}

export const config = {
	matcher: ["/dashboard", "/dashboard/:path*"],
};
