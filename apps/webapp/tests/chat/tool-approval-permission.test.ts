import { describe, expect, it } from "vitest";

import { getToolApprovalPermission } from "@/components/chat/message/parts/tool-approval-permission";

describe("approval permissions", () => {
	it.each(["deleteContact", "deleteBlogPost", "unpublishBlogPost", "changeWebsiteTemplate", "generateWebsiteLayout"])(
		"requires owner permission for %s",
		(toolName) => {
			expect(getToolApprovalPermission({ input: {}, toolName })).toBe("delete");
		}
	);
	it.each([
		"createContact",
		"publishBlogPost",
		"publishWebsite",
		"publishLinkPage",
		"cancelWebsiteWorkflow",
		"cancelBlogPostGeneration",
	])("allows admin permission for %s", (toolName) => {
		expect(getToolApprovalPermission({ input: {}, toolName })).toBe("write");
	});
	it.each(["delete", "delete-menu-item", "remove-block", "remove-social"])(
		"detects %s in compound edits",
		(operation) => {
			expect(
				getToolApprovalPermission({
					input: { edits: [{ operation: "update-text" }, { operation }] },
					toolName: "editWebsite",
				})
			).toBe("delete");
		}
	);
});
