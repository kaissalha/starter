import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { validate as isUuid } from "uuid";

import { blogPosts, db, websites, websiteVersions } from "@starter/db";

import { projectWebsiteSnapshot, readPersistedWebsiteSite } from "./persistence-read";

const publishedWebsiteFilter = (websiteId: string) => and(eq(websites.id, websiteId), isNull(websites.suspendedAt));

export const getPublishedWebsiteVersionId = async ({ websiteId }: { websiteId: string }) => {
	if (!isUuid(websiteId)) {
		return null;
	}

	const [result] = await db
		.select({ publishedVersionId: websites.publishedVersionId })
		.from(websites)
		.where(publishedWebsiteFilter(websiteId))
		.limit(1);

	return result?.publishedVersionId ?? null;
};

export const getPublishedWebsiteState = async ({ websiteId }: { websiteId: string }) => {
	if (!isUuid(websiteId)) {
		return null;
	}

	const [result] = await db
		.select({
			hasBlog: sql<boolean>`exists (select 1 from ${blogPosts} where ${blogPosts.organizationId} = ${websites.organizationId} and ${blogPosts.publishedDocument} is not null and ${blogPosts.publishedAt} is not null)`,
			publishedVersionId: websites.publishedVersionId,
		})
		.from(websites)
		.where(publishedWebsiteFilter(websiteId))
		.limit(1);

	return result?.publishedVersionId
		? { hasBlog: result.hasBlog, publishedVersionId: result.publishedVersionId }
		: null;
};

export const getReadyWebsite = async ({
	publishedVersionId,
	websiteId,
}: {
	publishedVersionId?: string;
	websiteId: string;
}) => {
	if (!isUuid(websiteId) || (publishedVersionId !== undefined && !isUuid(publishedVersionId))) {
		return null;
	}

	if (publishedVersionId) {
		const [published] = await db
			.select({ version: websiteVersions })
			.from(websiteVersions)
			.innerJoin(websites, eq(websites.id, websiteVersions.websiteId))
			.where(
				and(
					eq(websiteVersions.id, publishedVersionId),
					eq(websiteVersions.websiteId, websiteId),
					isNotNull(websiteVersions.publishedAt),
					isNull(websites.suspendedAt)
				)
			)
			.limit(1);

		return published
			? projectWebsiteSnapshot({ site: readPersistedWebsiteSite({ record: published.version }) })
			: null;
	}

	const [result] = await db
		.select({ version: websiteVersions })
		.from(websites)
		.innerJoin(
			websiteVersions,
			and(eq(websiteVersions.id, websites.publishedVersionId), eq(websiteVersions.websiteId, websites.id))
		)
		.where(and(eq(websites.id, websiteId), isNull(websites.suspendedAt)))
		.limit(1);

	return result ? projectWebsiteSnapshot({ site: readPersistedWebsiteSite({ record: result.version }) }) : null;
};
