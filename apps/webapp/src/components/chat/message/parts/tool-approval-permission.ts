import { z } from "zod";

import type { OrganizationPermission } from "@starter/server/permissions";

const approvalEditsSchema = z.looseObject({
	edits: z.array(z.looseObject({ operation: z.string() })).optional(),
});

export const getToolApprovalPermission = ({ input }: { input: unknown }): OrganizationPermission => {
	const parsed = approvalEditsSchema.safeParse(input);

	if (
		!parsed.success ||
		parsed.data.edits?.some(({ operation }) => operation.startsWith("delete") || operation.startsWith("remove"))
	) {
		return "delete";
	}

	return "write";
};
