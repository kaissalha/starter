import { isDeepStrictEqual } from "node:util";
import { ZodError } from "zod";

import {
	editWebsiteSnapshot,
	listWebsiteSectionLayouts,
	WebsiteEditError,
	type WebsiteEditInput,
} from "@starter/infinite-website/editing";
import {
	createGenerationTemplateBrand,
	websiteGenerationProfiles,
	type WebsiteSnapshotV1,
} from "@starter/infinite-website/generation";

import {
	editWebsite,
	getWebsite,
	WebsiteDraftNotFoundError,
	WebsiteMutationConflictError,
	WebsiteTemplateChangeTargetError,
} from "./service";

const preserveContentLayout = ({ input, snapshot }: { input: WebsiteEditInput; snapshot: WebsiteSnapshotV1 }) => {
	try {
		const next = editWebsiteSnapshot({ input, snapshot });

		return isDeepStrictEqual(next.document.content, snapshot.document.content) &&
			isDeepStrictEqual(next.document.logic, snapshot.document.logic)
			? next
			: null;
	} catch (error) {
		if (error instanceof WebsiteEditError || error instanceof ZodError) {
			return null;
		}

		throw error;
	}
};

export const prepareWebsiteTemplateRestyle = ({
	snapshot,
	templateId,
}: {
	snapshot: WebsiteSnapshotV1;
	templateId: string;
}) => {
	const profile = websiteGenerationProfiles.find((candidate) => candidate.templateId === templateId);

	if (!profile) {
		return null;
	}

	const patterns = new Set(profile.sections.map(({ pattern }) => pattern));

	const inputs: Array<WebsiteEditInput> = [
		{
			brand: {
				...createGenerationTemplateBrand({ locale: snapshot.document.defaultLocale, profile }),
				logo: snapshot.brand.logo,
			},
			operation: "update-brand",
		},
	];

	const state = { snapshot: editWebsiteSnapshot({ input: inputs[0]!, snapshot }) };

	for (const { index, pageId, section } of snapshot.document.structure.pages.flatMap((page) =>
		page.sections.map((section, index) => ({ index, pageId: page.id, section }))
	)) {
		const candidates = listWebsiteSectionLayouts({
			document: state.snapshot.document,
			target: { area: "page", index, pageId, sectionId: section.id },
		}).filter(
			({ generationRequired, pattern }) =>
				!generationRequired && patterns.has(pattern) && pattern !== section.source?.pattern
		);

		for (const { pattern } of candidates) {
			const input: WebsiteEditInput = {
				operation: "swap-layout",
				pageId,
				pattern,
				sectionId: section.id,
			};

			const next = preserveContentLayout({ input, snapshot: state.snapshot });

			if (!next) {
				continue;
			}

			inputs.push(input);
			state.snapshot = next;
			break;
		}
	}

	return { inputs, snapshot: { ...state.snapshot, templateId } };
};

export const restyleWebsiteTemplate = async ({
	organizationId,
	templateId,
	updatedAt,
	websiteId,
}: {
	organizationId: string;
	templateId: string;
	updatedAt: string;
	websiteId: string;
}) => {
	const website = await getWebsite({ organizationId });

	if (!website?.snapshot || website.id !== websiteId) {
		throw new WebsiteDraftNotFoundError();
	}

	if (website.updatedAt !== updatedAt) {
		throw new WebsiteMutationConflictError();
	}

	const restyled = prepareWebsiteTemplateRestyle({ snapshot: website.snapshot, templateId });

	if (!restyled) {
		throw new WebsiteTemplateChangeTargetError();
	}

	return editWebsite({ inputs: restyled.inputs, organizationId, templateId, updatedAt, websiteId });
};
