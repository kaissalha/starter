export const getBaseURL = () => {
	if (globalThis.window) {
		const origin = window.location?.origin;

		if (origin) {
			try {
				return new URL("/", origin);
			} catch {}
		}
	}

	if (
		process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ||
		process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF === "main" ||
		process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF === "master"
	) {
		const candidate =
			process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
			`https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?.trim() ?? ""}`;

		if (URL.canParse(candidate) && new URL(candidate).protocol === "https:") {
			return new URL("/", candidate);
		}

		throw new Error(
			"Production origin is not configured: set NEXT_PUBLIC_BASE_URL to the app's public https origin"
		);
	}

	if (process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL) {
		return new URL(`https://${process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL}`);
	}

	if (process.env.NEXT_PUBLIC_VERCEL_URL) {
		return new URL(`https://${process.env.NEXT_PUBLIC_VERCEL_URL}`);
	}

	return new URL(`http://localhost:${process.env.PORT ?? "3000"}`);
};

export const getHostnameFromUrl = ({ url }: { url: string }) =>
	URL.canParse(url) ? new URL(url).hostname.toLocaleLowerCase().replace(/^www\./iu, "") : url;

export const resolveUrl = ({ base, href }: { base: string; href: string }) => {
	if (href.startsWith("//")) {
		return `https:${href}`;
	}

	if (href.startsWith("/")) {
		return new URL(href, base).href;
	}

	if (href.startsWith("http")) {
		return href;
	}

	return new URL(href, base).href;
};
