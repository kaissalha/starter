import { RPCHandler } from "@orpc/server/fetch";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	defaultLinkPageBrand,
	defaultLinkPageSectionAppearance,
	type LinkPageDocument,
	type LinkPageState,
} from "@starter/infinite-links/contracts";
import { createDefaultLinkPageDocument } from "@starter/infinite-links/document";

const mocks = vi.hoisted(() => ({
	getChatWithMessages: vi.fn(),
	resolveSession: vi.fn(),
	saveLinkPage: vi.fn(),
}));

vi.mock("../../src/services/permissions", () => ({
	requireOrganizationPermission: vi.fn(async () => "owner"),
}));

vi.mock("../../src/services/chat", () => ({
	convertChatMessagesForUI: vi.fn(),
	getChatWithMessages: mocks.getChatWithMessages,
}));

vi.mock("next/headers", () => ({
	headers: vi.fn(async () => new Headers()),
}));

vi.mock("../../src/lib/auth", () => ({
	resolveSession: mocks.resolveSession,
}));

vi.mock("../../src/services/link-pages", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/services/link-pages")>()),
	saveLinkPage: mocks.saveLinkPage,
}));

import { linkPages } from "../../src/api/routers/link-pages";

const handler = new RPCHandler({ linkPages });

const organizationId = "organization-1";

const updatedAt = "2026-09-03T02:16:54.468Z";

const createDocument = (): LinkPageDocument => {
	const document = createDefaultLinkPageDocument({ name: "Half Million" });

	const socials = {
		appearance: defaultLinkPageSectionAppearance,
		enabled: true,
		id: "cceb8ac6-eca1-49f1-8b5d-a8320f16127d",
		items: [
			{
				id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d",
				platform: "instagram" as const,
				url: "https://www.instagram.com/kaissalha/",
			},
		],
		kind: "socials" as const,
	};

	return {
		...document,
		blocks: [
			socials,
			{
				appearance: defaultLinkPageSectionAppearance,
				design: "cards-07",
				display: "grid",
				enabled: true,
				id: "00000000-0000-4000-8000-000000000001",
				kind: "collection",
				links: [
					{
						appearance: defaultLinkPageSectionAppearance,
						description: { ar: "تفاصيل", en: "Details" },
						design: "buttons-02",
						enabled: true,
						id: "00000000-0000-4000-8000-000000000002",
						imageUrl: "https://example.com/card.jpg",
						kind: "link",
						label: { en: "Visit" },
						layout: "classic",
						url: "https://example.com",
					},
				],
				title: {},
			},
		],
		headerBlockIds: [socials.id],
		profile: { ...document.profile, bannerUrl: "https://example.com/cover.jpg", layout: "bold-01" },
	};
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.resolveSession.mockResolvedValue({
		session: { activeOrganizationId: organizationId },
		user: { email: "user@example.com", id: "user-1", name: "User" },
	});
});

describe("Link page mutations", () => {
	it("accepts a draft with a section linked to the header", async () => {
		const document = createDocument();

		const state: LinkPageState = {
			document,
			id: "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32e",
			inheritedBrand: defaultLinkPageBrand,
			publication: { hasUnpublishedChanges: true, publishedAt: null },
			updatedAt,
		};

		mocks.saveLinkPage.mockResolvedValue(state);

		const { response } = await handler.handle(
			new Request("https://example.com/api/rpc/linkPages/save", {
				body: JSON.stringify({ json: { document, updatedAt } }),
				headers: { "content-type": "application/json" },
				method: "POST",
			}),
			{ context: {}, prefix: "/api/rpc" }
		);

		expect(response?.status).toBe(200);
		expect(mocks.saveLinkPage).toHaveBeenCalledWith({ document, organizationId, updatedAt, userId: "user-1" });
	});
});

it("keeps Links agent history stable and isolated by user and organization", async () => {
	mocks.getChatWithMessages.mockResolvedValue(null);
	const ids: Array<string> = [];

	for (const [organization, userId] of [
		[organizationId, "user-1"],
		[organizationId, "user-1"],
		[organizationId, "user-2"],
		["organization-2", "user-1"],
	]) {
		mocks.resolveSession.mockResolvedValue({
			session: { activeOrganizationId: organization },
			user: { email: "user@example.com", id: userId, name: "User" },
		});

		const { response } = await handler.handle(
			new Request("https://example.com/api/rpc/linkPages/agentChat", {
				body: JSON.stringify({ json: null }),
				headers: { "content-type": "application/json" },
				method: "POST",
			}),
			{ context: {}, prefix: "/api/rpc" }
		);

		expect(response?.status).toBe(200);
		const call = mocks.getChatWithMessages.mock.lastCall?.[0];
		expect(call.organizationId).toBe(organization);
		ids.push(call.chatId);
	}

	expect(ids[0]).toBe(ids[1]);
	expect(new Set(ids).size).toBe(3);
});
