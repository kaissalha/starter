export const getLoginRedirect = (redirectUrl: string | null) => {
	if (!redirectUrl?.startsWith("/")) {
		return null;
	}

	try {
		const url = new URL(redirectUrl, "https://local.invalid");
		const pathname = decodeURIComponent(url.pathname);

		if (
			url.origin !== "https://local.invalid" ||
			pathname.startsWith("//") ||
			pathname.includes("\\") ||
			/^\/(?:en\/|ar\/)?(?:login|signup)(?:\/|$)/.test(pathname)
		) {
			return null;
		}

		return `${url.pathname}${url.search}${url.hash}`;
	} catch {
		return null;
	}
};
