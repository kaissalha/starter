import { z } from "zod";

import type { OrganizationPermission } from "@starter/server/permissions";

const approvalEditsSchema = z.looseObject({
	edits: z.array(z.looseObject({ operation: z.string() })).optional(),
	logic: z.json().optional(),
	remove: z.array(z.string()).optional(),
});

export const getToolApprovalPermission = ({
	input,
	toolName,
}: {
	input: unknown;
	toolName: string;
}): OrganizationPermission => {
	if (
		[
			"deleteContact",
			"deleteBlogPost",
			"unpublishBlogPost",
			"changeWebsiteTemplate",
			"generateWebsiteLayout",
		].includes(toolName)
	) {
		return "delete";
	}

	const parsed = approvalEditsSchema.safeParse(input);

	if (!parsed.success) {
		return "delete";
	}

	if (
		parsed.data.remove?.length ||
		parsed.data.logic === null ||
		parsed.data.edits?.some(({ operation }) => operation.startsWith("delete") || operation.startsWith("remove"))
	) {
		return "delete";
	}

	return "write";
};
