import { ORPCError } from "@orpc/client";

import type { JsonValue } from "@starter/infinite-website";
import { editWebsiteSnapshots, entityIdSchema, type WebsiteEditInput } from "@starter/infinite-website/editing";

import { hasOrganizationPermission } from "../../utils/permissions";
import { requireOrganizationPermission } from "../permissions";
import { getWebsite } from "./service";

const collectWebsiteEntityIds = (value: JsonValue | undefined): Array<string> => {
	if (Array.isArray(value)) {
		return value.flatMap(collectWebsiteEntityIds);
	}

	if (!(value instanceof Object)) {
		return [];
	}

	const id = entityIdSchema.safeParse(value.id);

	return [...(id.success ? [id.data] : []), ...Object.values(value).flatMap(collectWebsiteEntityIds)];
};

export const requireWebsiteEditPermission = async ({
	inputs,
	organizationId,
	userId,
}: {
	inputs: Array<WebsiteEditInput>;
	organizationId: string;
	userId: string;
}) => {
	const role = await requireOrganizationPermission({ organizationId, permission: "write", userId });

	if (hasOrganizationPermission({ permission: "delete", role })) {
		return;
	}

	if (inputs.some(({ operation }) => ["delete", "delete-menu-item", "delete-collection-item"].includes(operation))) {
		throw new ORPCError("FORBIDDEN", { message: "Only owners can remove website content." });
	}

	const website = await getWebsite({ organizationId });

	if (!website?.snapshot) {
		return;
	}

	const next = editWebsiteSnapshots({ inputs, snapshot: website.snapshot });
	const remaining = new Set(collectWebsiteEntityIds(next.document.structure));

	if (
		collectWebsiteEntityIds(website.snapshot.document.structure).some((id) => !remaining.has(id)) ||
		Object.keys(website.snapshot.document.logic ?? {}).some((id) => !next.document.logic?.[id])
	) {
		throw new ORPCError("FORBIDDEN", { message: "Only owners can remove website content." });
	}
};
