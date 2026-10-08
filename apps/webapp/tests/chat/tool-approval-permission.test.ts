import { describe, expect, it } from "vitest";

import { getToolApprovalPermission } from "@/components/chat/message/parts/tool-approval-permission";

describe("approval permissions", () => {
	it("allows admin permission for plain input", () => {
		expect(getToolApprovalPermission({ input: {} })).toBe("write");
	});

	it("requires owner permission for unrecognized input", () => {
		expect(getToolApprovalPermission({ input: null })).toBe("delete");
	});

	it.each(["delete", "remove-block"])("detects %s in compound edits", (operation) => {
		expect(getToolApprovalPermission({ input: { edits: [{ operation: "update-text" }, { operation }] } })).toBe(
			"delete"
		);
	});
});
