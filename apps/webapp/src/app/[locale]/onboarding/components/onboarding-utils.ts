import { locales } from "@/i18n/routing";

const defaultRedirectPath = "/dashboard";

export const getOnboardingRedirectPath = ({ redirectUrl }: { redirectUrl?: string | Array<string> | undefined }) => {
	const value = Array.isArray(redirectUrl) ? redirectUrl[0] : redirectUrl;

	if (!value || !value.startsWith("/")) {
		return defaultRedirectPath;
	}

	const localePattern = new RegExp(`^/(?:${locales.join("|")})(?=/|\\?|$)`);
	const sanitizedPath = value.replace(localePattern, "") || "/";

	if (
		sanitizedPath === "/" ||
		sanitizedPath.startsWith("/login") ||
		sanitizedPath.startsWith("/signup") ||
		sanitizedPath.startsWith("/onboarding") ||
		sanitizedPath.startsWith("//")
	) {
		return defaultRedirectPath;
	}

	return sanitizedPath;
};

export const buildOrganizationSlug = ({ name, suffix }: { name: string; suffix?: string }) => {
	const normalizedSlug = name
		.normalize("NFKD")
		.toLowerCase()
		.replaceAll(/[\u0300-\u036f]/g, "")
		.replaceAll(/[^a-z0-9\s-]/g, "")
		.trim()
		.replaceAll(/\s+/g, "-")
		.replaceAll(/-+/g, "-")
		.replaceAll(/^-|-$/g, "");

	if (!suffix) {
		return normalizedSlug || "organization";
	}

	return `${normalizedSlug || "organization"}-${suffix}`;
};
