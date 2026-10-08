import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { validate as isUuid } from "uuid";

import { db, linkPages, websites } from "@starter/db";
import type { PublishedLinkPage } from "@starter/infinite-links/contracts";

export const getPublishedLinkPageTimestamp = async ({ websiteId }: { websiteId: string }) => {
	if (!isUuid(websiteId)) {
		return null;
	}

	const [result] = await db
		.select({ publishedAt: linkPages.publishedAt })
		.from(websites)
		.innerJoin(linkPages, eq(linkPages.organizationId, websites.organizationId))
		.where(and(eq(websites.id, websiteId), isNull(websites.suspendedAt), isNotNull(linkPages.publishedAt)))
		.limit(1);

	return result?.publishedAt ?? null;
};

export const getReadyLinkPage = async ({
	publishedAt,
	websiteId,
}: {
	publishedAt?: string;
	websiteId: string;
}): Promise<PublishedLinkPage | null> => {
	if (!isUuid(websiteId)) {
		return null;
	}

	const [result] = await db
		.select({
			brand: linkPages.publishedBrand,
			document: linkPages.publishedDocument,
			publishedAt: linkPages.publishedAt,
		})
		.from(websites)
		.innerJoin(linkPages, eq(linkPages.organizationId, websites.organizationId))
		.where(
			and(
				eq(websites.id, websiteId),
				isNull(websites.suspendedAt),
				publishedAt ? eq(linkPages.publishedAt, publishedAt) : undefined,
				isNotNull(linkPages.publishedAt),
				isNotNull(linkPages.publishedBrand),
				isNotNull(linkPages.publishedDocument)
			)
		)
		.limit(1);

	if (!result?.brand || !result.document || !result.publishedAt) {
		return null;
	}

	return {
		brand: result.brand,
		document: result.document,
		publishedAt: result.publishedAt,
	};
};
