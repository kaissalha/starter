import {
	getWebsite,
	WebsiteSectionAdditionConflictError,
	WebsiteSectionAdditionTargetError,
} from "../../services/websites/service";

export const getWebsiteSnapshot = async ({
	notFound,
	organizationId,
	websiteId,
}: {
	notFound: () => Error;
	organizationId: string;
	websiteId: string;
}) => {
	const website = await getWebsite({ organizationId });

	if (!website?.snapshot || website.id !== websiteId) {
		throw notFound();
	}

	return website.snapshot;
};

export const startWebsiteModification = async <Input, PreparedInput>({
	errors,
	input,
	organizationId,
	prepare,
	start,
	updatedAt,
	websiteId,
}: {
	errors: { CONFLICT: () => Error; GENERATION_FAILED: () => Error; INVALID_TARGET: () => Error };
	input: Input;
	organizationId: string;
	prepare: (input: { input: Input; organizationId: string; websiteId: string }) => Promise<{
		expectedRunId: string | null;
		input: PreparedInput;
		record: { updatedAt: string };
	}>;
	start: (input: {
		expectedRunId: string | null;
		expectedUpdatedAt: string;
		input: PreparedInput;
		organizationId: string;
		websiteId: string;
	}) => Promise<{ websiteId: string; workflowRunId: string }>;
	updatedAt: string;
	websiteId: string;
}) => {
	const prepared = await (async () => {
		try {
			return await prepare({ input, organizationId, websiteId });
		} catch (error) {
			if (error instanceof WebsiteSectionAdditionConflictError) {
				throw errors.CONFLICT();
			}

			if (error instanceof WebsiteSectionAdditionTargetError) {
				throw errors.INVALID_TARGET();
			}

			throw error;
		}
	})();

	if (prepared.record.updatedAt !== updatedAt) {
		throw errors.CONFLICT();
	}

	try {
		return await start({
			expectedRunId: prepared.expectedRunId,
			expectedUpdatedAt: updatedAt,
			input: prepared.input,
			organizationId,
			websiteId,
		});
	} catch (error) {
		if (error instanceof WebsiteSectionAdditionConflictError) {
			throw errors.CONFLICT();
		}

		throw errors.GENERATION_FAILED();
	}
};
