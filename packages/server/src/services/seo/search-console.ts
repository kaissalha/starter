import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { accounts, db, websiteDomains } from "@starter/db";

import { getWebsiteRecord } from "../websites/service";

const searchConsoleScope = "https://www.googleapis.com/auth/webmasters.readonly";

const siteListSchema = z.object({
	siteEntry: z.array(z.object({ permissionLevel: z.string(), siteUrl: z.string() })).optional(),
});

const analyticsSchema = z.object({
	rows: z
		.array(
			z.object({
				clicks: z.number(),
				ctr: z.number(),
				impressions: z.number(),
				keys: z.array(z.string()).optional(),
				position: z.number(),
			})
		)
		.optional(),
});

type SearchAnalyticsRequest = { dimensions?: Array<"query">; endDate: string; rowLimit?: number; startDate: string };

export const searchConsoleOverviewSchema = z
	.discriminatedUnion("status", [
		z.object({ status: z.literal("noDomain") }),
		z.object({ status: z.literal("notConnected") }),
		z.object({ status: z.literal("propertyMissing") }),
		z.object({ status: z.literal("unavailable") }),
		z.object({
			clicks: z.number(),
			endDate: z.string(),
			impressions: z.number(),
			queries: z.array(z.object({ clicks: z.number(), impressions: z.number(), query: z.string() })),
			siteUrl: z.string(),
			startDate: z.string(),
			status: z.literal("available"),
		}),
	])
	.meta({ id: "SearchConsoleOverview" });

export const findSearchConsoleProperty = (sites: z.infer<typeof siteListSchema>["siteEntry"], hostname: string) =>
	sites?.find(({ permissionLevel, siteUrl }) => {
		const normalizedHostname = hostname.toLowerCase();

		if (permissionLevel === "siteUnverifiedUser") {
			return false;
		}

		if (siteUrl.startsWith("sc-domain:")) {
			const domain = siteUrl.slice("sc-domain:".length).toLowerCase();

			return normalizedHostname === domain || normalizedHostname.endsWith(`.${domain}`);
		}

		try {
			const url = new URL(siteUrl);

			return (
				url.protocol === "https:" && url.hostname.toLowerCase() === normalizedHostname && url.pathname === "/"
			);
		} catch {
			return false;
		}
	})?.siteUrl;

const googleJson = async (url: string, accessToken: string, body?: SearchAnalyticsRequest) => {
	const headers = new Headers({ Authorization: `Bearer ${accessToken}` });

	if (body) {
		headers.set("Content-Type", "application/json");
	}

	const response = await fetch(url, {
		body: body ? JSON.stringify(body) : undefined,
		headers,
		method: body ? "POST" : "GET",
		signal: AbortSignal.timeout(10_000),
	});

	if (!response.ok) {
		throw new Error(`Search Console request failed (${response.status})`);
	}

	return response.json();
};

export const getSearchConsoleOverview = async ({
	organizationId,
	userId,
}: {
	organizationId: string;
	userId: string;
}): Promise<z.infer<typeof searchConsoleOverviewSchema>> => {
	const website = await getWebsiteRecord({ organizationId });

	if (!website) {
		return { status: "noDomain" };
	}

	const [domain] = await db
		.select({ hostname: websiteDomains.hostname })
		.from(websiteDomains)
		.where(and(eq(websiteDomains.websiteId, website.id), eq(websiteDomains.primary, true)))
		.limit(1);

	if (!domain) {
		return { status: "noDomain" };
	}

	const [account] = await db
		.select({ id: accounts.id, scope: accounts.scope })
		.from(accounts)
		.where(and(eq(accounts.userId, userId), eq(accounts.providerId, "google")))
		.limit(1);

	if (!account?.scope?.split(" ").includes(searchConsoleScope)) {
		return { status: "notConnected" };
	}

	try {
		const { auth } = await import("../../lib/auth");
		const { accessToken } = await auth.api.getAccessToken({ body: { accountId: account.id, userId } });

		const sites = siteListSchema.parse(
			await googleJson("https://www.googleapis.com/webmasters/v3/sites", accessToken)
		);

		const siteUrl = findSearchConsoleProperty(sites.siteEntry, domain.hostname);

		if (!siteUrl) {
			return { status: "propertyMissing" };
		}

		const end = new Date();
		end.setUTCDate(end.getUTCDate() - 3);
		const start = new Date(end);
		start.setUTCDate(start.getUTCDate() - 27);
		const startDate = start.toISOString().slice(0, 10);
		const endDate = end.toISOString().slice(0, 10);
		const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;

		const [totals, terms] = await Promise.all([
			googleJson(endpoint, accessToken, { endDate, startDate }),
			googleJson(endpoint, accessToken, { dimensions: ["query"], endDate, rowLimit: 5, startDate }),
		]);

		const totalRows = analyticsSchema.parse(totals).rows ?? [];
		const queryRows = analyticsSchema.parse(terms).rows ?? [];

		return {
			clicks: totalRows[0]?.clicks ?? 0,
			endDate,
			impressions: totalRows[0]?.impressions ?? 0,
			queries: queryRows.flatMap((row) =>
				row.keys?.[0] ? [{ clicks: row.clicks, impressions: row.impressions, query: row.keys[0] }] : []
			),
			siteUrl,
			startDate,
			status: "available",
		};
	} catch {
		return { status: "unavailable" };
	}
};
