const DEFAULT_REDIRECT = "/";

/**
 * Only allow same-origin relative paths. Rejects absolute URLs,
 * protocol-relative URLs (`//evil.com`) and `/\evil.com`, which some
 * browsers treat as protocol-relative.
 */
export function safeRedirect(value?: string | null): string {
	if (!value?.startsWith("/")) {
		return DEFAULT_REDIRECT;
	}
	if (value.startsWith("//") || value.startsWith("/\\")) {
		return DEFAULT_REDIRECT;
	}
	return value;
}
