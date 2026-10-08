import type { ToolObserve } from "@mastra/core/tools";
import { ORPCError } from "@orpc/client";
import { and, eq } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";

import { db, linkPages, organizations, websites, websiteVersions, type LinkPageRecord } from "@starter/db";
import {
	defaultLinkPageBrand,
	linkPageDocumentSchema,
	type LinkPageDocument,
	type LinkPageState,
} from "@starter/infinite-links/contracts";
import { createDefaultLinkPageDocument, resolveLinkPageBrand } from "@starter/infinite-links/document";
import { linkPageThemes } from "@starter/infinite-links/themes";

import { evaluateDecision } from "../ai/decisions";
import { appearanceDecisionInstructions } from "../ai/prompts";
import { hasOrganizationPermission } from "../utils/permissions";
import { requireOrganizationPermission } from "./permissions";

const collectLinkPageItemIds = (document: LinkPageDocument) =>
	document.blocks.flatMap((block) => [
		block.id,
		...(block.kind === "collection" ? block.links.map(({ id }) => id) : []),
		...(block.kind === "socials" ? block.items.map(({ id }) => id) : []),
	]);

export const saveLinkPageInputSchema = z.compile(
	z
		.strictObject({ document: linkPageDocumentSchema, updatedAt: z.string().nullable() })
		.meta({ id: "SaveLinkPageInput" })
);

export const publishLinkPageInputSchema = z.compile(
	z.strictObject({ updatedAt: z.string() }).meta({ id: "PublishLinkPageInput" })
);

const nextIsoTimestamp = ({ current, now = Date.now() }: { current: string; now?: number }) =>
	new Date(Math.max(now, Date.parse(current) + 1)).toISOString();

export class LinkPageConflictError extends Error {
	constructor() {
		super("The links page changed elsewhere.");
		this.name = "LinkPageConflictError";
	}
}

export class LinkPageNotFoundError extends Error {
	constructor() {
		super("The links page draft was not found.");
		this.name = "LinkPageNotFoundError";
	}
}

const getOrganizationProfile = async ({ organizationId }: { organizationId: string }) => {
	const [organization] = await db
		.select({ name: organizations.name })
		.from(organizations)
		.where(eq(organizations.id, organizationId))
		.limit(1);

	return organization ?? { name: "Your links" };
};

const getOrganizationBrand = async ({ organizationId }: { organizationId: string }) => {
	const [result] = await db
		.select({ brand: websiteVersions.brand })
		.from(websites)
		.innerJoin(
			websiteVersions,
			and(eq(websiteVersions.id, websites.draftVersionId), eq(websiteVersions.websiteId, websites.id))
		)
		.where(eq(websites.organizationId, organizationId))
		.limit(1);

	return result?.brand ?? defaultLinkPageBrand;
};

const getLinkPageRecord = async ({ organizationId }: { organizationId: string }) => {
	const [record] = await db.select().from(linkPages).where(eq(linkPages.organizationId, organizationId)).limit(1);

	return record ?? null;
};

const projectLinkPageState = ({
	inheritedBrand,
	profile,
	record,
}: {
	inheritedBrand: LinkPageState["inheritedBrand"];
	profile?: { name: string };
	record: LinkPageRecord | null;
}): LinkPageState => {
	const document = record
		? record.document
		: createDefaultLinkPageDocument({
				brand: inheritedBrand,
				name: profile?.name ?? "Your links",
			});

	const publishedDocument = record?.publishedDocument ?? null;

	const effectiveBrand = resolveLinkPageBrand({
		brandOverride: document.appearance.brandOverride,
		inheritedBrand,
	});

	return {
		document,
		id: record?.id ?? null,
		inheritedBrand,
		publication: {
			hasUnpublishedChanges:
				!record?.publishedAt ||
				!isDeepStrictEqual(document, publishedDocument) ||
				!isDeepStrictEqual(effectiveBrand, record.publishedBrand),
			publishedAt: record?.publishedAt ?? null,
		},
		updatedAt: record?.updatedAt ?? null,
	};
};

export const getLinkPage = async ({ organizationId }: { organizationId: string }) => {
	const [record, inheritedBrand, profile] = await Promise.all([
		getLinkPageRecord({ organizationId }),
		getOrganizationBrand({ organizationId }),
		getOrganizationProfile({ organizationId }),
	]);

	return projectLinkPageState({ inheritedBrand, profile, record });
};

export const saveLinkPage = async ({
	document: input,
	organizationId,
	updatedAt,
	userId,
}: {
	document: LinkPageDocument;
	organizationId: string;
	updatedAt: string | null;
	userId: string;
}) => {
	const document = linkPageDocumentSchema.parse(input);
	const role = await requireOrganizationPermission({ organizationId, permission: "write", userId });

	const record = await db.transaction(async (transaction) => {
		const [current] = await transaction
			.select()
			.from(linkPages)
			.where(eq(linkPages.organizationId, organizationId))
			.for("update")
			.limit(1);

		if (!current) {
			if (updatedAt !== null) {
				throw new LinkPageConflictError();
			}

			const [created] = await transaction
				.insert(linkPages)
				.values({ document, organizationId })
				.onConflictDoNothing()
				.returning();

			if (!created) {
				throw new LinkPageConflictError();
			}

			return created;
		}

		if (current.updatedAt !== updatedAt) {
			throw new LinkPageConflictError();
		}

		const remaining = new Set(collectLinkPageItemIds(document));

		if (
			!hasOrganizationPermission({ permission: "delete", role }) &&
			collectLinkPageItemIds(current.document).some((id) => !remaining.has(id))
		) {
			throw new ORPCError("FORBIDDEN", { message: "Only owners can remove Links content." });
		}

		if (isDeepStrictEqual(current.document, document)) {
			return current;
		}

		const now = nextIsoTimestamp({ current: current.updatedAt });

		const [saved] = await transaction
			.update(linkPages)
			.set({ document, updatedAt: now })
			.where(and(eq(linkPages.id, current.id), eq(linkPages.updatedAt, current.updatedAt)))
			.returning();

		if (!saved) {
			throw new LinkPageConflictError();
		}

		return saved;
	});

	const inheritedBrand = await getOrganizationBrand({ organizationId });

	return projectLinkPageState({ inheritedBrand, record });
};

export const publishLinkPage = async ({ organizationId, updatedAt }: { organizationId: string; updatedAt: string }) => {
	const { inheritedBrand, record } = await db.transaction(async (transaction) => {
		const [current] = await transaction
			.select()
			.from(linkPages)
			.where(eq(linkPages.organizationId, organizationId))
			.for("update")
			.limit(1);

		if (!current) {
			throw new LinkPageNotFoundError();
		}

		if (current.updatedAt !== updatedAt) {
			throw new LinkPageConflictError();
		}

		const [website] = await transaction
			.select({ brand: websiteVersions.brand })
			.from(websites)
			.innerJoin(
				websiteVersions,
				and(eq(websiteVersions.id, websites.draftVersionId), eq(websiteVersions.websiteId, websites.id))
			)
			.where(eq(websites.organizationId, organizationId))
			.limit(1);

		const inheritedBrand = website?.brand ?? defaultLinkPageBrand;
		const currentDocument = current.document;

		const publishedBrand = resolveLinkPageBrand({
			brandOverride: currentDocument.appearance.brandOverride,
			inheritedBrand,
		});

		const now = nextIsoTimestamp({ current: current.updatedAt });

		const [published] = await transaction
			.update(linkPages)
			.set({
				publishedAt: now,
				publishedBrand,
				publishedDocument: currentDocument,
				updatedAt: now,
			})
			.where(and(eq(linkPages.id, current.id), eq(linkPages.updatedAt, current.updatedAt)))
			.returning();

		if (!published) {
			throw new LinkPageConflictError();
		}

		return { inheritedBrand, record: published };
	});

	return projectLinkPageState({ inheritedBrand, record });
};

const themeChoices = Object.fromEntries([
	["keep", "No suitable theme, ambiguous request, or exact custom values required"],
	...linkPageThemes.map(({ description, id }) => [id, description]),
]);

export const recommendLinkPageTheme = async ({
	abortSignal,
	observe,
	request,
}: {
	abortSignal?: AbortSignal;
	observe?: Pick<ToolObserve, "span">;
	request: string;
}) => {
	const result = await evaluateDecision({
		abortSignal,
		functionId: "links-theme-recommendation",
		memoize: true,
		observe,
		questions: {
			theme: { criteria: themeChoices, instructions: appearanceDecisionInstructions, type: "choice" },
		},
		state: { request },
	});

	return {
		probabilities: result?.answers.theme.probabilities ?? null,
		theme: linkPageThemes.find(({ id }) => id === result?.answers.theme.choice) ?? null,
	};
};
