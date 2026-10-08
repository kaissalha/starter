import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, websiteDomains } from "@starter/db";
import type { PersistedSiteNode } from "@starter/infinite-website";
import type { SiteDocument } from "@starter/infinite-website/contracts";

import { readPersistedWebsiteSite } from "../websites/persistence-read";
import { getWebsiteRecord, getWebsiteVersionRecord } from "../websites/service";

const issueCodeSchema = z.enum(["missingDescription", "missingTitle", "duplicateTitle", "missingH1", "multipleH1"]);

export const seoOverviewSchema = z
	.strictObject({
		issues: z.array(
			z.strictObject({
				code: issueCodeSchema,
				locale: z.string(),
				observed: z.string(),
				pageId: z.string(),
				path: z.string(),
			})
		),
		pageCount: z.number().int().nonnegative(),
		primaryDomain: z
			.strictObject({
				connected: z.boolean(),
				hostname: z.string(),
			})
			.nullable(),
		publishedAt: z.string().nullable(),
		websiteId: z.string().nullable(),
	})
	.meta({ id: "SeoOverview" });

export type SeoOverview = z.infer<typeof seoOverviewSchema>;

const resolveSeoDescription = ({
	document,
	locale,
	pageId,
}: {
	document: SiteDocument;
	locale: SiteDocument["defaultLocale"];
	pageId: string;
}) => {
	const localized = document.content[locale];
	const fallback = document.content[document.defaultLocale];

	return (
		localized?.pages[pageId]?.seo?.description ??
		fallback?.pages[pageId]?.seo?.description ??
		localized?.site.description ??
		fallback?.site.description ??
		""
	).trim();
};

const resolvePageSeoCopy = ({
	document,
	locale,
	page,
}: {
	document: SiteDocument;
	locale: SiteDocument["defaultLocale"];
	page: SiteDocument["structure"]["pages"][number];
}) => {
	const localized = document.content[locale];
	const fallback = document.content[document.defaultLocale];
	const slug = localized?.pages[page.id]?.route?.slug ?? fallback?.pages[page.id]?.route?.slug ?? "";
	const basePath = locale === document.defaultLocale ? "" : `/${locale}`;
	const path = page.home ? basePath || "/" : `${basePath}/${slug}`;
	const title = (localized?.pages[page.id]?.seo?.title ?? fallback?.pages[page.id]?.seo?.title ?? "").trim();

	return { description: resolveSeoDescription({ document, locale, pageId: page.id }), path, title };
};

const countHeadings = (node: PersistedSiteNode): number => {
	switch (node.type) {
		case "text":
			return node.props.element === "h1" ? 1 : 0;
		case "box":
		case "flex":
		case "grid":
		case "field":
		case "value":
		case "trigger":
		case "action":
		case "masonry":
			return node.props.children.reduce((count, child) => count + countHeadings(child), 0);
		case "carousel":
			return node.props.slides.reduce((count, child) => count + countHeadings(child), 0);
		case "disclosure":
		case "tabs":
			return node.props.items.reduce(
				(count, item) =>
					count +
					item.trigger.reduce((total, child) => total + countHeadings(child), 0) +
					item.panel.reduce((total, child) => total + countHeadings(child), 0),
				0
			);
		case "menu":
			return [
				...node.props.actions,
				...node.props.brand,
				...(node.props.socialActions ?? []),
				...node.props.items.flatMap((item) => [
					...item.trigger,
					...(item.panel ?? []),
					...(item.mobileTrigger ?? []),
				]),
			].reduce((count, child) => count + countHeadings(child), 0);
		default:
			return 0;
	}
};

const inspectPageSeo = ({
	document,
	locale,
	page,
	titles,
}: {
	document: SiteDocument;
	locale: SiteDocument["defaultLocale"];
	page: SiteDocument["structure"]["pages"][number];
	titles: Set<string>;
}): SeoOverview["issues"] => {
	const { description, path, title } = resolvePageSeoCopy({ document, locale, page });
	const issues: SeoOverview["issues"] = [];

	if (!title) {
		issues.push({ code: "missingTitle", locale, observed: "", pageId: page.id, path });
	} else if (titles.has(title.toLocaleLowerCase(locale))) {
		issues.push({ code: "duplicateTitle", locale, observed: title, pageId: page.id, path });
	}

	titles.add(title.toLocaleLowerCase(locale));

	if (!description) {
		issues.push({ code: "missingDescription", locale, observed: "", pageId: page.id, path });
	}

	const headingCount = page.sections.reduce((count, section) => count + countHeadings(section.root), 0);

	if (headingCount !== 1) {
		issues.push({
			code: headingCount === 0 ? "missingH1" : "multipleH1",
			locale,
			observed: String(headingCount),
			pageId: page.id,
			path,
		});
	}

	return issues;
};

export const inspectWebsiteSeo = (document: SiteDocument): SeoOverview["issues"] =>
	document.locales.flatMap((locale) => {
		const titles = new Set<string>();

		return document.structure.pages.flatMap((page) => inspectPageSeo({ document, locale, page, titles }));
	});

export const getSeoOverview = async ({ organizationId }: { organizationId: string }): Promise<SeoOverview> => {
	const website = await getWebsiteRecord({ organizationId });

	if (!website) {
		return { issues: [], pageCount: 0, primaryDomain: null, publishedAt: null, websiteId: null };
	}

	const [version, domains] = await Promise.all([
		getWebsiteVersionRecord({ versionId: website.publishedVersionId, websiteId: website.id }),
		db.select().from(websiteDomains).where(eq(websiteDomains.websiteId, website.id)),
	]);

	const primary = domains.find((domain) => domain.primary);
	const document = version ? readPersistedWebsiteSite({ record: version }).document : null;

	return {
		issues: document ? inspectWebsiteSeo(document) : [],
		pageCount: document ? document.structure.pages.length * document.locales.length : 0,
		primaryDomain: primary
			? {
					connected:
						primary.status === "connected" &&
						primary.dnsReady &&
						primary.tlsReady &&
						primary.ownershipVerified,
					hostname: primary.hostname,
				}
			: null,
		publishedAt: version?.publishedAt ?? null,
		websiteId: website.id,
	};
};
