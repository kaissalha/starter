import { and, eq, isNotNull, isNull, or } from "drizzle-orm";
import { getRun } from "workflow/api";

import {
	db,
	websites,
	websiteVersions,
	type Transaction,
	type WebsiteRecord,
	type WebsiteVersionRecord,
} from "@starter/db";
import { editWebsiteSnapshots, WebsiteEditError, type WebsiteEditInput } from "@starter/infinite-website/editing";
import {
	websiteBriefSchema,
	websiteWritingVoice,
	websiteGenerationProfiles,
	websiteLayoutGenerationInputSchema,
	websiteSectionAdditionInputSchema,
	websiteTemplateChangeInputSchema,
	type PersistedWebsiteSiteV1,
	type Iso6391LanguageCode,
	type WebsiteBriefV1,
	type WebsiteLayoutGenerationInputV1,
	type WebsiteSectionAdditionInputV1,
	type WebsiteStateV1,
	type WebsiteTemplateChangeInputV1,
} from "@starter/infinite-website/generation";

import { OrganizationLogoNotFoundError, readOrganizationLogo, saveOrganizationLogo } from "../organization-logo";
import { resolveWebsiteUploadedMedia } from "./assets";
import { createWebsiteSubdomain } from "./domain-input";
import { prepareWebsiteEdits } from "./edit-preparation";
import { prepareWebsiteLayoutGeneration, WebsiteLayoutGenerationInputError } from "./layout-generation";
import { saveInitialWebsiteLinkPage } from "./link-page";
import {
	getWebsiteRecord,
	getWebsiteVersionRecord,
	isWebsiteWorkflowCompletionRecoverable,
	splitPersistedWebsiteSite,
} from "./persistence";
import { projectWebsiteSnapshot, readPersistedWebsiteSite } from "./persistence-read";
import { prepareWebsiteSectionAddition } from "./section-addition";
import { WebsiteSectionAdditionInputError } from "./section-catalog";
import { getAttachedWebsiteWorkflowState, reconcileWebsiteWorkflow } from "./workflow-stream";

export {
	getWebsiteRecord,
	getWebsiteVersionRecord,
	inferWebsiteWorkflowKind,
	isWebsiteWorkflowCompletionRecoverable,
	type WebsiteWorkflowKind,
} from "./persistence";

const nextIsoTimestamp = ({ current, now = Date.now() }: { current: string; now?: number }) =>
	new Date(Math.max(now, Date.parse(current) + 1)).toISOString();

type WebsiteMutationInput = { organizationId: string; updatedAt: string; websiteId: string };

export type WebsiteWorkflowClaim = {
	expectedRunId: string | null;
	organizationId: string;
	websiteId: string;
} & (
	| { brief: WebsiteBriefV1; kind: "generation" }
	| { expectedUpdatedAt: string; kind: "translation"; locale: Iso6391LanguageCode }
	| { brief: WebsiteBriefV1; expectedUpdatedAt: string; kind: "template-change" }
	| {
			brief?: never;
			expectedUpdatedAt: string;
			kind: "section-addition" | "layout-generation";
			locale?: never;
	  }
);

type ProjectWebsiteStateInput = {
	draftVersion: WebsiteVersionRecord | null;
	publishedVersion: Pick<WebsiteVersionRecord, "publishedAt"> | null | undefined;
	record: WebsiteRecord;
	workflow: Awaited<ReturnType<typeof getAttachedWebsiteWorkflowState>>;
};

export class WebsiteGenerationConflictError extends Error {
	constructor() {
		super("This organization already has a website or an active generation.");
		this.name = "WebsiteGenerationConflictError";
	}
}

export class WebsiteSectionAdditionConflictError extends Error {
	constructor() {
		super("This website already has an active section addition.");
		this.name = "WebsiteSectionAdditionConflictError";
	}
}

export class WebsiteSectionAdditionTargetError extends Error {
	constructor() {
		super("The requested page, insertion index, or pattern is not available for this website.");
		this.name = "WebsiteSectionAdditionTargetError";
	}
}

export class WebsiteTemplateChangeTargetError extends Error {
	constructor() {
		super("The requested template is not available for this website.");
		this.name = "WebsiteTemplateChangeTargetError";
	}
}

export class WebsiteMutationConflictError extends Error {
	constructor() {
		super("This website already has an active operation or changed elsewhere.");
		this.name = "WebsiteMutationConflictError";
	}
}

export class WebsiteDraftNotFoundError extends Error {
	constructor() {
		super("The website draft was not found.");
		this.name = "WebsiteDraftNotFoundError";
	}
}

const getTransactionWebsiteVersion = async ({
	transaction,
	versionId,
	websiteId,
}: {
	transaction: Transaction;
	versionId: string | null;
	websiteId: string;
}) => {
	if (!versionId) {
		return null;
	}

	const [version] = await transaction
		.select()
		.from(websiteVersions)
		.where(and(eq(websiteVersions.websiteId, websiteId), eq(websiteVersions.id, versionId)))
		.limit(1);

	return version ?? null;
};

const lockWebsiteRecord = async ({
	organizationId,
	transaction,
	websiteId,
}: {
	organizationId: string;
	transaction: Transaction;
	websiteId: string;
}) => {
	const [record] = await transaction
		.select()
		.from(websites)
		.where(and(eq(websites.organizationId, organizationId), eq(websites.id, websiteId)))
		.for("update")
		.limit(1);

	return record ?? null;
};

const lockWebsiteDraft = async ({
	organizationId,
	transaction,
	updatedAt,
	websiteId,
}: {
	organizationId: string;
	transaction: Transaction;
	updatedAt: string;
	websiteId: string;
}) => {
	const record = await lockWebsiteRecord({ organizationId, transaction, websiteId });

	if (!record?.draftVersionId) {
		throw new WebsiteDraftNotFoundError();
	}

	if (record.workflowRunId || record.updatedAt !== updatedAt) {
		throw new WebsiteMutationConflictError();
	}

	const draftVersion = await getTransactionWebsiteVersion({
		transaction,
		versionId: record.draftVersionId,
		websiteId: record.id,
	});

	if (!draftVersion) {
		throw new WebsiteDraftNotFoundError();
	}

	return { draftVersion, record };
};

const projectWebsiteState = ({
	draftVersion,
	publishedVersion,
	record,
	workflow,
}: ProjectWebsiteStateInput): WebsiteStateV1 => ({
	brief: record.brief,
	createdAt: record.createdAt,
	id: record.id,
	locale: record.locale,
	publication: {
		hasUnpublishedChanges: record.draftVersionId !== null && record.draftVersionId !== record.publishedVersionId,
		publishedAt: publishedVersion?.publishedAt ?? null,
	},
	snapshot: draftVersion
		? projectWebsiteSnapshot({ site: readPersistedWebsiteSite({ record: draftVersion }) })
		: null,
	updatedAt: record.updatedAt,
	workflow,
});

const projectWebsiteStateWithDraft = ({
	draftVersion,
	publishedVersion,
	record,
}: {
	draftVersion: WebsiteVersionRecord;
	publishedVersion: Pick<WebsiteVersionRecord, "publishedAt"> | null | undefined;
	record: WebsiteRecord;
}) => {
	const state = projectWebsiteState({ draftVersion, publishedVersion, record, workflow: null });

	if (!state.snapshot) {
		throw new Error("Website draft projection is missing its snapshot");
	}

	return { ...state, snapshot: state.snapshot };
};

export const getWebsite = async ({ organizationId }: { organizationId: string }) => {
	const record = await getWebsiteRecord({ organizationId });

	if (!record) {
		return null;
	}

	const [draftVersion, publishedVersion, workflow] = await Promise.all([
		getWebsiteVersionRecord({ versionId: record.draftVersionId, websiteId: record.id }),
		record.publishedVersionId
			? db.query.websiteVersions.findFirst({
					columns: { publishedAt: true },
					where: { id: record.publishedVersionId, websiteId: record.id },
				})
			: null,
		getAttachedWebsiteWorkflowState({ record }),
	]);

	return projectWebsiteState({ draftVersion, publishedVersion, record, workflow });
};

export const getReplaceableWorkflowRunId = async ({
	conflict,
	record,
}: {
	conflict: WebsiteGenerationConflictError | WebsiteSectionAdditionConflictError;
	record: WebsiteRecord;
}) => {
	if (!record.workflowRunId) {
		return null;
	}

	const run = getRun(record.workflowRunId);

	if ((await run.exists) && ["pending", "running"].includes(await run.status)) {
		throw conflict;
	}

	return record.workflowRunId;
};

export const prepareWebsiteGenerationStart = async ({
	brief,
	organizationId,
}: {
	brief: WebsiteBriefV1;
	organizationId: string;
}) => {
	const parsedBrief = websiteBriefSchema.parse({ ...brief, voice: websiteWritingVoice({ brief }) });

	const [inserted] = await db
		.insert(websites)
		.values({
			brief: parsedBrief,
			locale: "en",
			organizationId,
			subdomain: createWebsiteSubdomain(parsedBrief.name),
		})
		.onConflictDoNothing({ target: websites.organizationId })
		.returning();

	const record = inserted ?? (await getWebsiteRecord({ organizationId }));

	if (!record) {
		throw new Error("Website reservation disappeared");
	}

	if (record.draftVersionId) {
		throw new WebsiteGenerationConflictError();
	}

	return {
		brief: parsedBrief,
		expectedRunId: await getReplaceableWorkflowRunId({ conflict: new WebsiteGenerationConflictError(), record }),
		record,
	};
};

export const prepareWebsiteSectionAdditionStart = async ({
	input,
	organizationId,
	websiteId,
}: {
	input: WebsiteSectionAdditionInputV1;
	organizationId: string;
	websiteId: string;
}) => {
	const parsedInput = websiteSectionAdditionInputSchema.parse(input);
	const record = await getWebsiteRecord({ organizationId, websiteId });

	const draftVersion = record
		? await getWebsiteVersionRecord({ versionId: record.draftVersionId, websiteId: record.id })
		: null;

	if (!record || !draftVersion) {
		throw new WebsiteSectionAdditionTargetError();
	}

	try {
		prepareWebsiteSectionAddition({
			brief: record.brief,
			input: parsedInput,
			snapshot: projectWebsiteSnapshot({ site: readPersistedWebsiteSite({ record: draftVersion }) }),
			websiteId,
			workflowRunId: "validation",
		});
	} catch (error) {
		if (error instanceof WebsiteSectionAdditionInputError) {
			throw new WebsiteSectionAdditionTargetError();
		}

		throw error;
	}

	return {
		expectedRunId: await getReplaceableWorkflowRunId({
			conflict: new WebsiteSectionAdditionConflictError(),
			record,
		}),
		input: parsedInput,
		record,
	};
};

export const prepareWebsiteLayoutGenerationStart = async ({
	input,
	organizationId,
	websiteId,
}: {
	input: WebsiteLayoutGenerationInputV1;
	organizationId: string;
	websiteId: string;
}) => {
	const parsedInput = websiteLayoutGenerationInputSchema.parse(input);
	const record = await getWebsiteRecord({ organizationId, websiteId });

	const draftVersion = record
		? await getWebsiteVersionRecord({ versionId: record.draftVersionId, websiteId: record.id })
		: null;

	if (!record || !draftVersion) {
		throw new WebsiteSectionAdditionTargetError();
	}

	try {
		prepareWebsiteLayoutGeneration({
			brief: record.brief,
			input: parsedInput,
			snapshot: projectWebsiteSnapshot({ site: readPersistedWebsiteSite({ record: draftVersion }) }),
			websiteId,
			workflowRunId: "validation",
		});
	} catch (error) {
		if (error instanceof WebsiteLayoutGenerationInputError) {
			throw new WebsiteSectionAdditionTargetError();
		}

		throw error;
	}

	return {
		expectedRunId: await getReplaceableWorkflowRunId({
			conflict: new WebsiteSectionAdditionConflictError(),
			record,
		}),
		input: parsedInput,
		record,
	};
};

export const prepareWebsiteTemplateChangeStart = async ({
	input,
	organizationId,
	websiteId,
}: {
	input: WebsiteTemplateChangeInputV1;
	organizationId: string;
	websiteId: string;
}) => {
	const parsedInput = websiteTemplateChangeInputSchema.parse(input);
	const record = await getWebsiteRecord({ organizationId, websiteId });

	const draftVersion = record
		? await getWebsiteVersionRecord({ versionId: record.draftVersionId, websiteId: record.id })
		: null;

	if (
		!record ||
		!draftVersion ||
		!websiteGenerationProfiles.some(({ templateId }) => templateId === parsedInput.templateId)
	) {
		throw new WebsiteTemplateChangeTargetError();
	}

	const snapshot = projectWebsiteSnapshot({ site: readPersistedWebsiteSite({ record: draftVersion }) });

	if (snapshot.templateId === parsedInput.templateId) {
		throw new WebsiteTemplateChangeTargetError();
	}

	return {
		brief: record.brief,
		expectedRunId: await getReplaceableWorkflowRunId({
			conflict: new WebsiteGenerationConflictError(),
			record,
		}),
		input: parsedInput,
		record,
	};
};

export const claimWebsiteWorkflowRun = async (input: WebsiteWorkflowClaim & { runId: string }) => {
	const [record] = await db
		.update(websites)
		.set({
			brief:
				input.kind === "generation" || input.kind === "template-change"
					? websiteBriefSchema.parse(input.brief)
					: undefined,
			locale: input.kind === "generation" ? "en" : undefined,
			translationLocale: input.kind === "translation" ? input.locale : null,
			updatedAt:
				input.kind === "generation"
					? new Date().toISOString()
					: nextIsoTimestamp({ current: input.expectedUpdatedAt }),
			workflowRunId: input.runId,
		})
		.where(
			and(
				eq(websites.organizationId, input.organizationId),
				eq(websites.id, input.websiteId),
				input.kind === "generation" ? isNull(websites.draftVersionId) : isNotNull(websites.draftVersionId),
				input.kind !== "generation" ? eq(websites.updatedAt, input.expectedUpdatedAt) : undefined,
				input.expectedRunId === null
					? isNull(websites.workflowRunId)
					: or(isNull(websites.workflowRunId), eq(websites.workflowRunId, input.expectedRunId))
			)
		)
		.returning();

	if (record) {
		return record;
	}

	const existing = await getWebsiteRecord({ organizationId: input.organizationId, websiteId: input.websiteId });

	return existing?.workflowRunId === input.runId ? existing : null;
};

export const getWebsiteWorkflowContext = async ({
	organizationId,
	websiteId,
	workflowRunId,
}: {
	organizationId: string;
	websiteId: string;
	workflowRunId: string;
}) => {
	const record = await getWebsiteRecord({ organizationId, websiteId });

	if (!record || record.workflowRunId !== workflowRunId) {
		return null;
	}

	const draftVersion = await getWebsiteVersionRecord({ versionId: record.draftVersionId, websiteId: record.id });

	if (!draftVersion) {
		return null;
	}

	return {
		brief: record.brief,
		site: readPersistedWebsiteSite({ record: draftVersion }),
	};
};

const persistWebsiteDraftVersion = async ({
	currentVersion,
	documentAlreadyValidated = false,
	now,
	record,
	site,
	transaction,
}: {
	currentVersion: WebsiteVersionRecord | null;
	documentAlreadyValidated?: boolean;
	now: string;
	record: WebsiteRecord;
	site: PersistedWebsiteSiteV1;
	transaction: Transaction;
}) => {
	const columns = splitPersistedWebsiteSite({ documentAlreadyValidated, site });

	if (!currentVersion || currentVersion.publishedAt || currentVersion.templateId !== columns.templateId) {
		const [created] = await transaction
			.insert(websiteVersions)
			.values({
				version: currentVersion ? currentVersion.version + 1 : 1,
				websiteId: record.id,
				...columns,
				updatedAt: now,
			})
			.returning();

		if (!created) {
			throw new Error("Website draft version was not created");
		}

		return created;
	}

	const [updated] = await transaction
		.update(websiteVersions)
		.set({ ...columns, updatedAt: now })
		.where(and(eq(websiteVersions.id, currentVersion.id), isNull(websiteVersions.publishedAt)))
		.returning();

	if (!updated) {
		throw new WebsiteMutationConflictError();
	}

	return updated;
};

export const completeWebsiteWorkflow = async ({
	organizationId,
	site,
	websiteId,
	workflowRunId,
}: {
	organizationId: string;
	site: PersistedWebsiteSiteV1;
	websiteId: string;
	workflowRunId: string;
}) => {
	const version = await db.transaction(async (transaction) => {
		const record = await lockWebsiteRecord({ organizationId, transaction, websiteId });

		if (!record) {
			return null;
		}

		if (record.workflowRunId !== workflowRunId) {
			if (!isWebsiteWorkflowCompletionRecoverable({ record, workflowRunId })) {
				return null;
			}

			return getTransactionWebsiteVersion({
				transaction,
				versionId: record.draftVersionId,
				websiteId: record.id,
			});
		}

		const now = nextIsoTimestamp({ current: record.updatedAt });

		const currentVersion = await getTransactionWebsiteVersion({
			transaction,
			versionId: record.draftVersionId,
			websiteId: record.id,
		});

		if (record.draftVersionId && !currentVersion) {
			throw new Error("Website draft version disappeared");
		}

		const logo = currentVersion
			? readPersistedWebsiteSite({ record: currentVersion }).brand.logo
			: await readOrganizationLogo({ executor: transaction, organizationId });

		const saved = await persistWebsiteDraftVersion({
			currentVersion,
			now,
			record,
			site: { ...site, brand: { ...site.brand, logo } },
			transaction,
		});

		await saveInitialWebsiteLinkPage({ currentVersion, organizationId, site, transaction });

		await transaction
			.update(websites)
			.set({ draftVersionId: saved.id, translationLocale: null, updatedAt: now, workflowRunId: null })
			.where(and(eq(websites.id, record.id), eq(websites.workflowRunId, workflowRunId)));

		return saved;
	});

	return version ? projectWebsiteSnapshot({ site: readPersistedWebsiteSite({ record: version }) }) : null;
};

export const cancelWebsiteWorkflow = async ({
	organizationId,
	websiteId,
	workflowRunId,
}: {
	organizationId: string;
	websiteId: string;
	workflowRunId: string;
}) => {
	const record = await getWebsiteRecord({ organizationId, websiteId });

	if (!record || record.workflowRunId !== workflowRunId) {
		return false;
	}

	const run = getRun(workflowRunId);

	if (await run.exists) {
		await run.cancel({ cancelReason: "Cancelled by the website editor" });
	}

	const [updated] = await db
		.update(websites)
		.set({
			translationLocale: null,
			updatedAt: nextIsoTimestamp({ current: record.updatedAt }),
			workflowRunId: null,
		})
		.where(
			and(
				eq(websites.organizationId, organizationId),
				eq(websites.id, websiteId),
				eq(websites.workflowRunId, workflowRunId)
			)
		)
		.returning({ id: websites.id });

	return Boolean(updated);
};

export const editWebsite = async ({
	assetBindings,
	inputs,
	organizationId,
	templateId,
	updatedAt,
	websiteId,
}: {
	assetBindings?: PersistedWebsiteSiteV1["assetBindings"];
	inputs: Array<WebsiteEditInput>;
	organizationId: string;
	templateId?: string;
	updatedAt: string;
	websiteId: string;
}) => {
	if (inputs.length === 0) {
		throw new WebsiteEditError();
	}

	await reconcileWebsiteWorkflow({ organizationId, websiteId });

	const preparedInputs = await prepareWebsiteEdits({
		inputs,
		readSnapshot: () =>
			db.transaction(async (transaction) => {
				const locked = await lockWebsiteDraft({ organizationId, transaction, updatedAt, websiteId });

				return readPersistedWebsiteSite({ record: locked.draftVersion });
			}),
	});

	const uploads = await resolveWebsiteUploadedMedia({ inputs: preparedInputs, organizationId });

	const result = await db.transaction(async (transaction) => {
		const locked = await lockWebsiteDraft({ organizationId, transaction, updatedAt, websiteId });

		const current = readPersistedWebsiteSite({ record: locked.draftVersion });
		const site = editWebsiteSnapshots({ inputs: preparedInputs, snapshot: current });
		site.templateId = templateId ?? site.templateId;

		if (site.brand.logo?.src !== current.brand.logo?.src) {
			try {
				await saveOrganizationLogo({ executor: transaction, logo: site.brand.logo, organizationId });
			} catch (error) {
				if (error instanceof OrganizationLogoNotFoundError) {
					throw new WebsiteEditError(error.message);
				}

				throw error;
			}
		}

		Object.assign(site.assetBindings, assetBindings, uploads);

		const now = nextIsoTimestamp({ current: locked.record.updatedAt });

		const saved = await persistWebsiteDraftVersion({
			currentVersion: locked.draftVersion,
			documentAlreadyValidated: true,
			now,
			record: locked.record,
			site,
			transaction,
		});

		const [updated] = await transaction
			.update(websites)
			.set({ draftVersionId: saved.id, updatedAt: now })
			.where(
				and(
					eq(websites.id, locked.record.id),
					eq(websites.updatedAt, updatedAt),
					isNull(websites.workflowRunId)
				)
			)
			.returning();

		if (!updated) {
			throw new WebsiteMutationConflictError();
		}

		const publishedVersion = await getTransactionWebsiteVersion({
			transaction,
			versionId: updated.publishedVersionId,
			websiteId: updated.id,
		});

		return { draftVersion: saved, publishedVersion, record: updated };
	});

	return projectWebsiteStateWithDraft(result);
};

export const publishWebsite = async ({ organizationId, updatedAt, websiteId }: WebsiteMutationInput) => {
	await reconcileWebsiteWorkflow({ organizationId, websiteId });

	const result = await db.transaction(async (transaction) => {
		const locked = await lockWebsiteDraft({ organizationId, transaction, updatedAt, websiteId });

		if (locked.record.publishedVersionId === locked.draftVersion.id) {
			return { record: locked.record, version: locked.draftVersion };
		}

		const now = nextIsoTimestamp({ current: locked.record.updatedAt });

		const [publishedVersion] = await transaction
			.update(websiteVersions)
			.set({ publishedAt: now, updatedAt: now })
			.where(eq(websiteVersions.id, locked.draftVersion.id))
			.returning();

		const [updated] = await transaction
			.update(websites)
			.set({ publishedVersionId: locked.draftVersion.id, updatedAt: now })
			.where(
				and(
					eq(websites.id, locked.record.id),
					eq(websites.updatedAt, updatedAt),
					isNull(websites.workflowRunId)
				)
			)
			.returning();

		if (!publishedVersion || !updated) {
			throw new WebsiteMutationConflictError();
		}

		return { record: updated, version: publishedVersion };
	});

	return projectWebsiteStateWithDraft({
		draftVersion: result.version,
		publishedVersion: result.version,
		record: result.record,
	});
};

export const unpublishWebsite = async (input: WebsiteMutationInput) => {
	await reconcileWebsiteWorkflow(input);

	const { draftVersion, record } = await db.transaction(async (transaction) => {
		const locked = await lockWebsiteDraft({ ...input, transaction });

		const [updated] = await transaction
			.update(websites)
			.set({ publishedVersionId: null, updatedAt: nextIsoTimestamp({ current: locked.record.updatedAt }) })
			.where(eq(websites.id, locked.record.id))
			.returning();

		return { draftVersion: locked.draftVersion, record: updated ?? locked.record };
	});

	return projectWebsiteStateWithDraft({ draftVersion, publishedVersion: null, record });
};
