import { describe, expect, it } from "vitest";

import { hasOrganizationPermission, organizationRoles } from "../../src/utils/permissions";

describe("organization permissions", () => {
	it.each([
		{ read: true, remove: true, role: "owner", write: true },
		{ read: true, remove: false, role: "admin", write: true },
		{ read: true, remove: false, role: "member", write: false },
		{ read: false, remove: false, role: "unknown", write: false },
		{ read: false, remove: false, role: "owner,member", write: false },
		{ read: false, remove: false, role: null, write: false },
	])("enforces workspace access for $role", ({ read, remove, role, write }) => {
		expect(hasOrganizationPermission({ permission: "read", role })).toBe(read);
		expect(hasOrganizationPermission({ permission: "write", role })).toBe(write);
		expect(hasOrganizationPermission({ permission: "delete", role })).toBe(remove);
	});

	it("allows administrative edits and reserves destructive organization actions for owners", () => {
		const edits = { invitation: ["create"], member: ["create", "update"], organization: ["update"] } as const;
		const removals = { invitation: ["cancel"], member: ["delete"], organization: ["delete"] } as const;
		expect(organizationRoles.owner.authorize(edits).success).toBe(true);
		expect(organizationRoles.admin.authorize(edits).success).toBe(true);
		expect(organizationRoles.member.authorize(edits).success).toBe(false);
		expect(organizationRoles.owner.authorize(removals).success).toBe(true);
		expect(organizationRoles.admin.authorize(removals).success).toBe(false);
		expect(organizationRoles.member.authorize(removals).success).toBe(false);
	});
});
