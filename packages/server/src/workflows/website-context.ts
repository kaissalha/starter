import { getWorkflowMetadata } from "workflow";

import { projectWebsiteSnapshot } from "../services/websites/persistence-read";
import { getWebsiteWorkflowContext } from "../services/websites/service";

export const getWebsiteSectionWorkflowContext = async ({
	organizationId,
	websiteId,
}: {
	organizationId: string;
	websiteId: string;
}) => {
	const { workflowRunId } = getWorkflowMetadata();
	const context = await getWebsiteWorkflowContext({ organizationId, websiteId, workflowRunId });

	if (!context) {
		throw new Error("Website section workflow context is no longer available");
	}

	return {
		existingAssetBindings: context.site.assetBindings,
		generation: {
			brief: context.brief,
			snapshot: projectWebsiteSnapshot({ site: context.site }),
			websiteId,
			workflowRunId,
		},
	};
};
