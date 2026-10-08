import { RPCHandler } from "@orpc/server/fetch";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	createGenerationTemplateBrand,
	websiteGenerationProfiles,
	websiteSnapshotSchema,
	type WebsiteSnapshotV1,
} from "@starter/infinite-website/generation";
import { templatePreviews } from "@starter/infinite-website/template-previews";

const mocks = vi.hoisted(() => ({
	createWebsiteHomepagePreviewSkeleton: vi.fn(),
	generateWebsiteHomepagePreview: vi.fn(),
	generateWebsiteLayoutPreview: vi.fn(),
	getWebsite: vi.fn(),
	organizationId: "organization-one",
	prepareWebsiteTemplateChangeStart: vi.fn(),
	prepareWebsiteTemplateRestyle: vi.fn(),
	role: "owner",
	startWebsiteGeneration: vi.fn(),
	WebsiteGenerationConflictError: class WebsiteGenerationConflictError extends Error {},
	WebsiteTemplateChangeTargetError: class WebsiteTemplateChangeTargetError extends Error {},
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

vi.mock("../../src/lib/auth", () => ({
	resolveSession: async () => ({
		session: { activeOrganizationId: mocks.organizationId },
		user: { id: "user-one" },
	}),
}));

vi.mock("../../src/services/permissions", () => ({ requireOrganizationPermission: async () => mocks.role }));

vi.mock("../../src/services/websites/service", () => ({
	getWebsite: mocks.getWebsite,
	prepareWebsiteTemplateChangeStart: mocks.prepareWebsiteTemplateChangeStart,
	WebsiteDraftNotFoundError: class WebsiteDraftNotFoundError extends Error {},
	WebsiteGenerationConflictError: mocks.WebsiteGenerationConflictError,
	WebsiteMutationConflictError: class WebsiteMutationConflictError extends Error {},
	WebsiteTemplateChangeTargetError: mocks.WebsiteTemplateChangeTargetError,
}));

vi.mock("../../src/workflows/start", () => ({ startWebsiteGeneration: mocks.startWebsiteGeneration }));

vi.mock("../../src/services/websites/layout-generation", () => ({
	generateWebsiteLayoutPreview: mocks.generateWebsiteLayoutPreview,
	WebsiteLayoutGenerationInputError: class WebsiteLayoutGenerationInputError extends Error {},
}));

vi.mock("../../src/services/websites/homepage-preview", () => ({
	createWebsiteHomepagePreviewSkeleton: mocks.createWebsiteHomepagePreviewSkeleton,
	generateWebsiteHomepagePreview: mocks.generateWebsiteHomepagePreview,
}));

vi.mock("../../src/services/websites/template-restyle", () => ({
	prepareWebsiteTemplateRestyle: mocks.prepareWebsiteTemplateRestyle,
	restyleWebsiteTemplate: vi.fn(),
}));

vi.mock("../../src/services/websites/text-generation", () => ({
	generateWebsiteText: vi.fn(),
	WebsiteTextGenerationInputError: class WebsiteTextGenerationInputError extends Error {},
}));

import { websitePreviews } from "../../src/api/routers/website-previews";
import { websiteTemplates } from "../../src/api/routers/website-templates";

const original = templatePreviews[0]!;

const persistedJson = JSON.stringify({
	assets: original.assets,
	brand: createGenerationTemplateBrand({
		locale: "en",
		profile: websiteGenerationProfiles.find(({ templateId }) => templateId === original.id)!,
	}),
	document: original.document,
	schemaVersion: 1,
	templateId: original.id,
});

const storedSnapshot = websiteSnapshotSchema.parse(JSON.parse(persistedJson));

const { content, logic, ...structure } = storedSnapshot.document;

const persistedSnapshot: WebsiteSnapshotV1 = {
	...storedSnapshot,
	document: { ...structure, content, logic: logic ?? {} },
};

const website = {
	brief: { location: "Toronto", name: "North Studio", type: "Design studio" },
	id: "00000000-0000-4000-8000-000000000001",
	snapshot: persistedSnapshot,
	updatedAt: "2026-09-18T12:00:00.000Z",
};

const page = persistedSnapshot.document.structure.pages[0]!;

const target = { area: "page", index: 0, pageId: page.id, sectionId: page.sections[0]!.id } as const;

const handler = new RPCHandler({ websites: { ...websitePreviews, ...websiteTemplates } });

const previewLayout = async ({ snapshot }: { snapshot: WebsiteSnapshotV1 }) => {
	const { response } = await handler.handle(
		new Request("https://example.com/api/rpc/websites/previewLayout", {
			body: JSON.stringify({
				json: { locale: "en", pattern: "banner-card", snapshot, target, websiteId: website.id },
			}),
			headers: { "content-type": "application/json" },
			method: "POST",
		}),
		{ prefix: "/api/rpc" }
	);

	return response;
};

const previewTemplate = async ({ mode, templateId = original.id }: { mode: string; templateId?: string }) => {
	const { response } = await handler.handle(
		new Request("https://example.com/api/rpc/websites/previewTemplate", {
			body: JSON.stringify({ json: { locale: "en", mode, templateId, websiteId: website.id } }),
			headers: { "content-type": "application/json" },
			method: "POST",
		}),
		{ prefix: "/api/rpc" }
	);

	return response;
};

const changeTemplate = async () => {
	const { response } = await handler.handle(
		new Request("https://example.com/api/rpc/websites/changeTemplate", {
			body: JSON.stringify({
				json: { templateId: original.id, updatedAt: website.updatedAt, websiteId: website.id },
			}),
			headers: { "content-type": "application/json" },
			method: "POST",
		}),
		{ prefix: "/api/rpc" }
	);

	return response;
};

const preparedTemplateChange = {
	brief: website.brief,
	expectedRunId: "run-previous",
	input: { schemaVersion: 1, templateId: original.id },
	record: { updatedAt: website.updatedAt },
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.organizationId = "organization-one";
	mocks.role = "owner";
	mocks.getWebsite.mockResolvedValue(website);
	mocks.generateWebsiteLayoutPreview.mockResolvedValue(persistedSnapshot);
	mocks.createWebsiteHomepagePreviewSkeleton.mockReturnValue(persistedSnapshot);
	mocks.generateWebsiteHomepagePreview.mockResolvedValue(persistedSnapshot);
	mocks.prepareWebsiteTemplateRestyle.mockReturnValue({ snapshot: persistedSnapshot });
	mocks.prepareWebsiteTemplateChangeStart.mockResolvedValue(preparedTemplateChange);
	mocks.startWebsiteGeneration.mockResolvedValue({ websiteId: website.id, workflowRunId: "run-next" });
});

describe("website layout preview cache boundary", () => {
	it("reuses equivalent saved content despite boundary validation changing object property order", async () => {
		const requestSnapshot = websiteSnapshotSchema.parse(persistedSnapshot);
		expect(requestSnapshot).toEqual(persistedSnapshot);
		expect(JSON.stringify(requestSnapshot)).not.toBe(JSON.stringify(persistedSnapshot));

		expect((await previewLayout({ snapshot: requestSnapshot }))?.status).toBe(200);
		expect(mocks.generateWebsiteLayoutPreview).toHaveBeenCalledOnce();
		expect(mocks.generateWebsiteLayoutPreview.mock.calls[0]?.[0].input).toEqual({
			pattern: "banner-card",
			schemaVersion: 1,
			target,
		});
		expect(mocks.generateWebsiteLayoutPreview.mock.calls[0]?.[0].previewScope).toEqual({
			organizationId: "organization-one",
			revision: website.updatedAt,
			websiteId: website.id,
		});
	});

	it("previews an edited draft without trusting its generated fields for persisted apply", async () => {
		const edited = structuredClone(persistedSnapshot);
		edited.document.content.en!.site.name = "Unpersisted business name";

		expect((await previewLayout({ snapshot: edited }))?.status).toBe(200);
		expect(mocks.generateWebsiteLayoutPreview.mock.calls[0]?.[0].previewScope).toBeUndefined();
		expect(mocks.generateWebsiteLayoutPreview.mock.calls[0]?.[0].snapshot).toEqual(edited);
	});

	it("rejects an edited draft that fails full document validation before generation", async () => {
		const invalid = structuredClone(persistedSnapshot);
		invalid.document.structure.pages = invalid.document.structure.pages.map((page) => ({ ...page, home: false }));

		expect((await previewLayout({ snapshot: invalid }))?.status).toBe(400);
		expect(mocks.getWebsite).toHaveBeenCalled();
		expect(mocks.generateWebsiteLayoutPreview).not.toHaveBeenCalled();
	});

	it("binds reusable fields to the server's current revision", async () => {
		const currentRevision = "2026-09-18T12:00:01.000Z";
		mocks.getWebsite.mockResolvedValueOnce({ ...website, updatedAt: currentRevision });

		expect((await previewLayout({ snapshot: persistedSnapshot }))?.status).toBe(200);
		expect(mocks.generateWebsiteLayoutPreview.mock.calls[0]?.[0].previewScope?.revision).toBe(currentRevision);
	});

	it("rejects a website from another organization before generation or cache population", async () => {
		mocks.organizationId = "organization-two";
		mocks.getWebsite.mockResolvedValueOnce({ ...website, id: "00000000-0000-4000-8000-000000000002" });

		expect((await previewLayout({ snapshot: persistedSnapshot }))?.status).toBe(404);
		expect(mocks.getWebsite).toHaveBeenCalledWith({ organizationId: "organization-two" });
		expect(mocks.generateWebsiteLayoutPreview).not.toHaveBeenCalled();
	});
});

describe("website preview permissions", () => {
	it("rejects a member before loading the website or generating", async () => {
		mocks.role = "member";

		expect((await previewLayout({ snapshot: persistedSnapshot }))?.status).toBe(403);
		expect(mocks.getWebsite).not.toHaveBeenCalled();
		expect(mocks.generateWebsiteLayoutPreview).not.toHaveBeenCalled();
	});
});

describe("website template preview", () => {
	it.each([
		["skeleton", mocks.createWebsiteHomepagePreviewSkeleton],
		["generated", mocks.generateWebsiteHomepagePreview],
	])("routes %s previews to the homepage preview service", async (mode, preview) => {
		expect((await previewTemplate({ mode }))?.status).toBe(200);
		expect(preview.mock.calls[0]?.[0]).toMatchObject({
			brief: website.brief,
			locale: "en",
			previewScope: { organizationId: "organization-one", revision: website.updatedAt, websiteId: website.id },
			templateId: original.id,
			websiteId: website.id,
		});
		expect(mocks.prepareWebsiteTemplateRestyle).not.toHaveBeenCalled();
	});

	it("restyles the saved snapshot without generating", async () => {
		expect((await previewTemplate({ mode: "restyle" }))?.status).toBe(200);
		expect(mocks.prepareWebsiteTemplateRestyle).toHaveBeenCalledWith({
			snapshot: persistedSnapshot,
			templateId: original.id,
		});
		expect(mocks.generateWebsiteHomepagePreview).not.toHaveBeenCalled();
	});

	it("rejects a template that cannot restyle the saved snapshot", async () => {
		mocks.prepareWebsiteTemplateRestyle.mockReturnValueOnce(undefined);

		expect((await previewTemplate({ mode: "restyle" }))?.status).toBe(500);
	});

	it("rejects an unknown template before previewing", async () => {
		expect((await previewTemplate({ mode: "generated", templateId: "missing" }))?.status).toBe(500);
		expect(mocks.generateWebsiteHomepagePreview).not.toHaveBeenCalled();
	});
});

describe("website template change", () => {
	it("starts generation with the prepared template and expected revision", async () => {
		expect((await changeTemplate())?.status).toBe(200);
		expect(mocks.prepareWebsiteTemplateChangeStart).toHaveBeenCalledWith({
			input: { schemaVersion: 1, templateId: original.id },
			organizationId: "organization-one",
			websiteId: website.id,
		});
		expect(mocks.startWebsiteGeneration).toHaveBeenCalledWith({
			brief: website.brief,
			expectedRunId: "run-previous",
			expectedUpdatedAt: website.updatedAt,
			organizationId: "organization-one",
			templateId: original.id,
			websiteId: website.id,
		});
	});

	it("rejects a stale revision before starting generation", async () => {
		mocks.prepareWebsiteTemplateChangeStart.mockResolvedValueOnce({
			...preparedTemplateChange,
			record: { updatedAt: "2026-09-18T12:00:01.000Z" },
		});

		expect((await changeTemplate())?.status).toBe(409);
		expect(mocks.startWebsiteGeneration).not.toHaveBeenCalled();
	});

	it.each([
		[new mocks.WebsiteGenerationConflictError(), 409],
		[new mocks.WebsiteTemplateChangeTargetError(), 500],
	])("maps preparation failures", async (error, status) => {
		mocks.prepareWebsiteTemplateChangeStart.mockRejectedValueOnce(error);

		expect((await changeTemplate())?.status).toBe(status);
		expect(mocks.startWebsiteGeneration).not.toHaveBeenCalled();
	});

	it.each([
		[new mocks.WebsiteGenerationConflictError(), 409],
		[new Error("workflow unavailable"), 500],
	])("maps start failures", async (error, status) => {
		mocks.startWebsiteGeneration.mockRejectedValueOnce(error);

		expect((await changeTemplate())?.status).toBe(status);
	});

	it("rejects a member before preparing the change", async () => {
		mocks.role = "member";

		expect((await changeTemplate())?.status).toBe(403);
		expect(mocks.prepareWebsiteTemplateChangeStart).not.toHaveBeenCalled();
	});
});
