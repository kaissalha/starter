import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultLinkPageBrand } from "@starter/infinite-links/contracts";
import { nordicEdgeTemplate } from "@starter/infinite-website/templates/nordic-edge";
import nordicEdgeContent from "@starter/infinite-website/templates/nordic-edge/content";

import { instantiateTemplate } from "../../../infinite-website/src/templates/template-definition";
import { hasOrganizationPermission, type OrganizationPermission } from "../../src/utils/permissions";

const mocks = vi.hoisted(() => ({ getWebsite: vi.fn(), role: "admin" }));

vi.mock("../../src/services/websites/service", () => ({ getWebsite: mocks.getWebsite }));

vi.mock("../../src/services/permissions", () => ({
	requireOrganizationPermission: async ({ permission }: { permission: OrganizationPermission }) => {
		if (!hasOrganizationPermission({ permission, role: mocks.role })) {
			throw new ORPCError("FORBIDDEN");
		}

		return mocks.role;
	},
}));

import { requireWebsiteEditPermission } from "../../src/services/websites/permissions";

const document = instantiateTemplate({
	content: nordicEdgeContent,
	createId: () => crypto.randomUUID(),
	definition: nordicEdgeTemplate,
	path: "/website",
});

const page = document.structure.pages[0];

const section = page?.sections[0];

if (!page || !section || section.root.type !== "box") {
	throw new Error("Website fixture has no section");
}

const target = { pageId: page.id, sectionId: section.id };

const actor = { organizationId: "org", userId: "user" };

describe("website edit permissions", () => {
	beforeEach(() => {
		mocks.role = "admin";
		mocks.getWebsite.mockResolvedValue({ snapshot: { brand: defaultLinkPageBrand, document } });
	});
	it("allows an admin to save an existing section and forbids deleting it", async () => {
		await expect(
			requireWebsiteEditPermission({
				...actor,
				inputs: [{ ...target, operation: "replace-section-root", root: section.root }],
			})
		).resolves.toBeUndefined();
		await expect(
			requireWebsiteEditPermission({ ...actor, inputs: [{ ...target, operation: "delete" }] })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
	it("detects deleted nodes hidden in a section replacement", async () => {
		const root = { ...section.root, props: { ...section.root.props, children: [] } };
		await expect(
			requireWebsiteEditPermission({ ...actor, inputs: [{ ...target, operation: "replace-section-root", root }] })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
	it("allows owner deletion and denies all member edits", async () => {
		mocks.role = "owner";
		await expect(
			requireWebsiteEditPermission({ ...actor, inputs: [{ ...target, operation: "delete" }] })
		).resolves.toBeUndefined();
		mocks.role = "member";
		await expect(
			requireWebsiteEditPermission({
				...actor,
				inputs: [{ ...target, operation: "replace-section-root", root: section.root }],
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});
