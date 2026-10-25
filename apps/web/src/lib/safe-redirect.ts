const DEFAULT_REDIRECT = "/";
const PLACEHOLDER_ORIGIN = "http://placeholder.local";

/**
 * Only allow same-origin relative paths. Parses the value the same way the
 * browser will, so tricks like `//evil.com`, `/\evil.com` or `/\t/evil.com`
 * (tabs and newlines are stripped by the URL parser) resolve to a foreign
 * origin and are rejected.
 */
export function safeRedirect(value?: string | null): string {
	if (!value?.startsWith("/")) {
		return DEFAULT_REDIRECT;
	}
	try {
		const url = new URL(value, PLACEHOLDER_ORIGIN);
		if (url.origin !== PLACEHOLDER_ORIGIN) {
			return DEFAULT_REDIRECT;
		}
		return `${url.pathname}${url.search}${url.hash}`;
	} catch {
		return DEFAULT_REDIRECT;
	}
}
