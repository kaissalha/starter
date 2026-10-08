import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { db, linkPages, websites, websiteVersions } from "@starter/db";
import { brandFoundationSchema } from "@starter/infinite-brand";
import { defaultLinkPageBrand } from "@starter/infinite-links/contracts";
import { createDefaultLinkPageDocument } from "@starter/infinite-links/document";
import {
	parseSiteDocument,
	persistedWebsiteContentSchema,
	persistedWebsiteLogicSchema,
	persistedWebsiteSiteSchema,
	persistedWebsiteStructureSchema,
} from "@starter/infinite-website/generation";

import persistedColumns from "../../../infinite-website/tests/fixtures/persisted-website-columns-v1.json";
import {
	getLinkPage,
	LinkPageConflictError,
	LinkPageNotFoundError,
	publishLinkPage,
	saveLinkPage,
} from "../../src/services/link-pages";
import { getPublishedLinkPageTimestamp, getReadyLinkPage } from "../../src/services/ready-link-page";
import { splitPersistedWebsiteSite } from "../../src/services/websites/persistence";
import { cleanupTestActors, createTestTeam } from "../helpers/db";

const cleanupIds: Array<string> = [];

afterEach(async () => {
	await cleanupTestActors(cleanupIds);
});

const createTeamWithWebsite = async (name: string) => {
	const { owner } = await createTestTeam({ cleanupIds, name });
	const websiteId = crypto.randomUUID();
	await db.insert(websites).values({
		brief: { location: "Toronto", name: "North Studio", schemaVersion: 1, type: "Design studio" },
		id: websiteId,
		locale: "en",
		organizationId: owner.organizationId,
	});

	return { owner, websiteId };
};

const saveFirst = async ({ name, owner }: { name: string; owner: { organizationId: string; userId: string } }) =>
	saveLinkPage({ ...owner, document: createDefaultLinkPageDocument({ name }), updatedAt: null });

describe("links publish and public read", () => {
	it("keeps serving the published document while the draft changes", async () => {
		const { owner, websiteId } = await createTeamWithWebsite("Published");
		const saved = await saveFirst({ name: "Published", owner });
		await expect(getReadyLinkPage({ websiteId })).resolves.toBeNull();

		const published = await publishLinkPage({
			organizationId: owner.organizationId,
			updatedAt: saved.updatedAt ?? "",
		});

		await expect(getReadyLinkPage({ publishedAt: "2000-01-01T00:00:00.000Z", websiteId })).resolves.toBeNull();
		await expect(getPublishedLinkPageTimestamp({ websiteId })).resolves.toBe(published.publication.publishedAt);
		await expect(getReadyLinkPage({ websiteId })).resolves.toMatchObject({
			document: published.document,
			publishedAt: published.publication.publishedAt,
		});

		const draft = structuredClone(published.document);
		draft.profile.title = { ar: "Draft edit", en: "Draft edit" };
		await saveLinkPage({ ...owner, document: draft, updatedAt: published.updatedAt });

		await expect(getLinkPage({ organizationId: owner.organizationId })).resolves.toMatchObject({
			document: { profile: { title: { en: "Draft edit" } } },
			publication: { hasUnpublishedChanges: true },
		});
		const ready = await getReadyLinkPage({ websiteId });
		expect(ready?.document.profile.title.en).toBe(published.document.profile.title.en);
	});

	it("rejects stale and missing publish targets", async () => {
		const { owner } = await createTeamWithWebsite("Stale");
		const saved = await saveFirst({ name: "Stale", owner });
		const edited = structuredClone(saved.document);
		edited.profile.title = { ar: "Second", en: "Second" };
		await saveLinkPage({ ...owner, document: edited, updatedAt: saved.updatedAt });

		await expect(
			publishLinkPage({ organizationId: owner.organizationId, updatedAt: saved.updatedAt ?? "" })
		).rejects.toBeInstanceOf(LinkPageConflictError);

		const { owner: other } = await createTeamWithWebsite("Never saved");
		await expect(
			publishLinkPage({ organizationId: other.organizationId, updatedAt: saved.updatedAt ?? "" })
		).rejects.toBeInstanceOf(LinkPageNotFoundError);
	});

	it("never serves another organization's page", async () => {
		const teamA = await createTeamWithWebsite("Team A");
		const saved = await saveFirst({ name: "Team A", owner: teamA.owner });

		const published = await publishLinkPage({
			organizationId: teamA.owner.organizationId,
			updatedAt: saved.updatedAt ?? "",
		});

		await expect(
			getReadyLinkPage({ websiteId: (await createTeamWithWebsite("Team B")).websiteId })
		).resolves.toBeNull();
		await expect(getReadyLinkPage({ websiteId: teamA.websiteId })).resolves.toMatchObject({
			document: published.document,
		});
	});

	it("publishes with the brand inherited from the draft website", async () => {
		const { owner, websiteId } = await createTeamWithWebsite("Brand");

		const [version] = await db
			.insert(websiteVersions)
			.values({
				...splitPersistedWebsiteSite({
					site: persistedWebsiteSiteSchema.parse({
						assetBindings: persistedColumns.assetBindings,
						brand: persistedColumns.brand,
						document: parseSiteDocument({
							...persistedWebsiteStructureSchema.parse(structuredClone(persistedColumns.structure)),
							content: persistedWebsiteContentSchema.parse(structuredClone(persistedColumns.content)),
							logic: persistedWebsiteLogicSchema.parse(structuredClone(persistedColumns.logic)),
						}),
						schemaVersion: 1,
						templateId: persistedColumns.templateId,
					}),
				}),
				brand: brandFoundationSchema.parse({
					...defaultLinkPageBrand,
					colors: { ...defaultLinkPageBrand.colors, primary: "#0f766e" },
				}),
				version: 1,
				websiteId,
			})
			.returning();

		if (!version) {
			throw new Error("Draft website version was not inserted");
		}

		await db.update(websites).set({ draftVersionId: version.id }).where(eq(websites.id, websiteId));
		const saved = await saveFirst({ name: "Brand", owner });
		await publishLinkPage({ organizationId: owner.organizationId, updatedAt: saved.updatedAt ?? "" });

		const ready = await getReadyLinkPage({ websiteId });
		expect(ready?.brand.colors.primary).toBe("#0f766e");
		const [row] = await db.select().from(linkPages).where(eq(linkPages.organizationId, owner.organizationId));
		expect(row?.publishedBrand?.colors.primary).toBe("#0f766e");
	});
});
