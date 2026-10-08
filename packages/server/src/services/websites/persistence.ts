import { and, eq } from "drizzle-orm";

import { db, websites, websiteVersions, type WebsiteRecord } from "@starter/db";
import {
	listSiteDocumentAssetIds,
	parseSiteDocument,
	persistedWebsiteContentSchema,
	persistedWebsiteLogicSchema,
	persistedWebsiteSiteSchema,
	persistedWebsiteStructureSchema,
	type PersistedWebsiteSiteV1,
	type WebsiteAssetBindings,
	type WebsiteSnapshotV1,
} from "@starter/infinite-website/generation";

export const splitPersistedWebsiteSite = ({
	documentAlreadyValidated = false,
	site,
}: {
	documentAlreadyValidated?: boolean;
	site: PersistedWebsiteSiteV1;
}) => {
	const document = documentAlreadyValidated ? site.document : parseSiteDocument(site.document);
	const { content, logic, ...structure } = document;
	const referencedAssetIds = new Set(listSiteDocumentAssetIds({ document }));

	return {
		assetBindings: Object.fromEntries(
			Object.entries(site.assetBindings).filter(([assetId]) => referencedAssetIds.has(assetId))
		),
		brand: site.brand,
		content: persistedWebsiteContentSchema.parse(content),
		logic: persistedWebsiteLogicSchema.parse(logic ?? {}),
		structure: persistedWebsiteStructureSchema.parse(structure),
		templateId: site.templateId,
	};
};

export const createPersistedWebsiteSite = ({
	assetBindings,
	snapshot,
}: {
	assetBindings: WebsiteAssetBindings;
	snapshot: WebsiteSnapshotV1;
}) =>
	persistedWebsiteSiteSchema.parse({
		assetBindings,
		brand: snapshot.brand,
		document: parseSiteDocument(snapshot.document),
		schemaVersion: 1,
		templateId: snapshot.templateId,
	});

export type WebsiteWorkflowKind = "generation" | "section-addition" | "layout-generation" | "translation";

export const inferWebsiteWorkflowKind = ({ workflowName }: { workflowName?: string }): WebsiteWorkflowKind | null => {
	if (workflowName?.endsWith("//translateWebsiteWorkflow")) {
		return "translation";
	}

	if (workflowName?.endsWith("//generateWebsiteLayoutWorkflow")) {
		return "layout-generation";
	}

	if (workflowName?.endsWith("//addWebsiteSectionWorkflow")) {
		return "section-addition";
	}

	return workflowName?.endsWith("//generateWebsiteWorkflow") ? "generation" : null;
};

export const getWebsiteRecord = async ({
	organizationId,
	websiteId,
}: {
	organizationId: string;
	websiteId?: string;
}) => {
	const [record] = await db
		.select()
		.from(websites)
		.where(
			websiteId
				? and(eq(websites.organizationId, organizationId), eq(websites.id, websiteId))
				: eq(websites.organizationId, organizationId)
		)
		.limit(1);

	return record ?? null;
};

export const getWebsiteVersionRecord = async ({
	versionId,
	websiteId,
}: {
	versionId: string | null;
	websiteId: string;
}) => {
	if (!versionId) {
		return null;
	}

	const [version] = await db
		.select()
		.from(websiteVersions)
		.where(and(eq(websiteVersions.websiteId, websiteId), eq(websiteVersions.id, versionId)))
		.limit(1);

	return version ?? null;
};

export const isWebsiteWorkflowCompletionRecoverable = ({
	record,
	workflowRunId,
}: {
	record: WebsiteRecord;
	workflowRunId: string;
}) => record.workflowRunId !== workflowRunId && record.workflowRunId === null && record.draftVersionId !== null;
