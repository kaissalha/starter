import { noopObserve } from "@mastra/core/tools";
import { ORPCError } from "@orpc/client";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { RPCHandler } from "@orpc/server/fetch";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ permission: vi.fn(), query: vi.fn(), session: vi.fn() }));

vi.mock("../../src/services/permissions", () => ({ requireOrganizationPermission: mocks.permission }));

vi.mock("../../src/lib/auth", () => ({
	resolveSession: mocks.session,
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-api-key": "starter_fixture" }) }));

vi.mock("@starter/analytics/tinybird", async (original) => ({
	...(await original<typeof import("@starter/analytics/tinybird")>()),
	createAnalyticsClient: () => ({
		analyticsBreakdown: { query: mocks.query },
		analyticsOverview: { query: mocks.query },
		analyticsRealtime: { query: mocks.query },
		analyticsWebVitals: { query: mocks.query },
	}),
}));

import { analyticsBatchSchema, analyticsFiltersSchema, resolveAnalyticsDates } from "@starter/analytics";

import { analyticsTools } from "../../src/ai/tools/analytics";
import { createDashboardChatRequestContext } from "../../src/ai/types";
import { analytics } from "../../src/api/routers/analytics";
import { getAnalyticsOverview, getAnalyticsRealtime } from "../../src/services/analytics";
import { analyticsReferrer, createAnalyticsRow } from "../../src/services/analytics/collection";

const actor = { organizationId: "organization-a", userId: "member" };

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-09-20T12:00:00Z"));
	mocks.permission.mockResolvedValue("member");
	mocks.session.mockResolvedValue({
		session: { activeOrganizationId: actor.organizationId },
		user: { id: actor.userId },
	});
	mocks.query.mockResolvedValue({ data: [] });
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

describe("analytics tenant boundary", () => {
	it("derives tenant identity from RPC context and refuses a forged organization filter", async () => {
		const handler = new RPCHandler({ analytics });

		for (const input of [{}, { organizationId: "organization-b" }]) {
			const { response } = await handler.handle(
				new Request("https://example.test/api/rpc/analytics/overview", {
					body: JSON.stringify({ json: input }),
					headers: { "content-type": "application/json" },
					method: "POST",
				}),
				{ context: {}, prefix: "/api/rpc" }
			);

			expect(response?.status).toBe("organizationId" in input ? 400 : 200);
		}

		expect(mocks.query).toHaveBeenCalledOnce();
		expect(mocks.query.mock.calls[0]?.[0].organization_id).toBe(actor.organizationId);
	});
	it("uses API-key auth and the same tenant-scoped service on REST", async () => {
		const handler = new OpenAPIHandler({ analytics });

		const { response } = await handler.handle(new Request("https://example.test/api/v1/analytics/realtime"), {
			context: { authMode: "session-or-api-key" },
			prefix: "/api/v1",
		});

		expect(response?.status).toBe(200);
		expect(mocks.session).toHaveBeenCalledWith(expect.any(Headers), true);
		expect(mocks.query).toHaveBeenCalledWith(expect.objectContaining({ organization_id: actor.organizationId }));
	});
	it("rechecks membership on every service call, including revocation between calls", async () => {
		await getAnalyticsRealtime({ actor, input: {} });
		mocks.permission.mockRejectedValue(new ORPCError("FORBIDDEN"));
		await expect(getAnalyticsRealtime({ actor, input: {} })).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(mocks.query).toHaveBeenCalledOnce();
	});
	it("uses assistant context and cannot query after membership is revoked", async () => {
		const requestContext = createDashboardChatRequestContext({ ...actor, role: "member" });
		const execute = analyticsTools.getAnalyticsRealtime.execute;

		if (!execute) {
			throw new Error("Analytics tool must execute.");
		}

		await execute({ domain: "", locale: "" }, { observe: noopObserve, requestContext });
		expect(mocks.query).toHaveBeenCalledWith(expect.objectContaining({ organization_id: actor.organizationId }));
		mocks.permission.mockRejectedValue(new ORPCError("FORBIDDEN"));
		await expect(execute({ domain: "", locale: "" }, { observe: noopObserve, requestContext })).rejects.toThrow(
			"Forbidden"
		);
		expect(mocks.query).toHaveBeenCalledOnce();
	});
});

describe("analytics reports and configuration", () => {
	it("distinguishes an empty report from a provider failure", async () => {
		expect((await getAnalyticsOverview({ actor, input: {} })).current.visitors).toBe(0);
		mocks.query.mockRejectedValue(new Error("provider detail must remain private"));
		await expect(getAnalyticsOverview({ actor, input: {} })).rejects.toThrow("Analytics is unavailable.");
	});
	it("bounds UTC dates and marks previous periods outside retention unavailable", () => {
		expect(resolveAnalyticsDates({})).toMatchObject({
			days: 30,
			from: "2026-08-22",
			previousFrom: "2026-07-23",
			previousTo: "2026-08-21",
			to: "2026-09-20",
		});
		expect(resolveAnalyticsDates({ from: "2025-08-20" }).previousAvailable).toBe(false);

		for (const input of [{ from: "2025-08-19" }, { to: "2026-09-21" }, { from: "2026-09-20", to: "2026-09-19" }]) {
			expect(() => resolveAnalyticsDates(input)).toThrow(RangeError);
		}

		expect(analyticsFiltersSchema.safeParse({ organization_id: "other" }).success).toBe(false);
		expect(resolveAnalyticsDates({ from: "2025-02-28" }, new Date("2026-03-31T12:00:00Z")).from).toBe("2025-02-28");
		expect(() => resolveAnalyticsDates({ from: "2025-02-27" }, new Date("2026-03-31T12:00:00Z"))).toThrow(
			RangeError
		);
	});
});

it("rejects forged collection fields and links and strips referrer and destination private data", () => {
	const event = {
		action: "link_click",
		id: "a1f2ef92-12eb-4b8c-8e53-57bc6b641895",
		linkId: "3c66ef9a-ee20-4a4e-b9aa-ac2c1950f268",
		path: "/links",
		referrer: "https://chatgpt.com/c/private?token=secret",
		sessionId: "e7901ab4-f92d-47ae-9e93-d95e0d173775",
		timestamp: "2026-09-20T12:00:00Z",
		visitorId: "f47b5aaf-ff96-4b5e-89e4-21fca6d06514",
		visitorSince: "2026-09-20T12:00:00Z",
	};

	expect(analyticsBatchSchema.safeParse({ events: [{ ...event, organizationId: "other" }] }).success).toBe(false);
	expect(analyticsBatchSchema.safeParse({ events: Array.from({ length: 33 }, () => event) }).success).toBe(false);
	const parsed = analyticsBatchSchema.parse({ events: [event] }).events[0];

	if (!parsed) {
		throw new Error("Missing fixture event");
	}

	const target = {
		contentId: "links",
		links: [{ id: event.linkId, url: "https://example.test/offer?email=private#token" }],
		locale: "en",
		path: "/links",
		sectionIds: [],
		surface: "links" as const,
	};

	const args = {
		context: {
			browser: "Safari",
			city: "Toronto",
			country: "CA",
			device: "mobile",
			domain: "site.test",
			latitude: 43.7,
			longitude: -79.4,
			os: "iOS",
			websiteId: "site",
		},
		event: parsed,
		organizationId: actor.organizationId,
		target,
	};

	expect(createAnalyticsRow(args)).toMatchObject({
		ai_source: "chatgpt.com",
		destination: "https://example.test/offer",
		organization_id: actor.organizationId,
		referrer: "chatgpt.com",
	});
	expect(createAnalyticsRow({ ...args, target: { ...target, links: [] } })).toBeNull();

	const outbound = (href: string) =>
		createAnalyticsRow({ ...args, event: { ...parsed, action: "outbound_click", href } })?.destination;

	expect(createAnalyticsRow({ ...args, event: { ...parsed, action: "page_view" } })?.destination).toBe("");
	expect(outbound("tel:+15550100")).toBe("tel:");
	expect(outbound("https://wa.me/15550100?text=hi#x")).toBe("https://wa.me/15550100");
	expect(outbound("/menu.pdf?download=1")).toBe("/menu.pdf");
	expect(outbound("javascript:alert(1)")).toBeUndefined();
	expect(
		createAnalyticsRow({ ...args, event: { ...parsed, action: "engagement", engagedTime: 4200 } })
	).toMatchObject({ city: "Toronto", engaged_time: 4200, os: "iOS" });
	expect(analyticsReferrer("javascript:alert(1)")).toBe("");
});
