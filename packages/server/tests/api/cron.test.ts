import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	dispatchEvents: vi.fn(async (_input?: { eventIds: Array<string> }) => ({ expanded: 0 })),
	runEventRetention: vi.fn(async () => ({ deleted: 0 })),
	sweepOrganizationPurges: vi.fn(async () => ({ cancelled: 0, completed: 1, failed: 0 })),
}));

vi.mock("../../src/services/organization-purge", () => ({
	sweepOrganizationPurges: mocks.sweepOrganizationPurges,
}));

vi.mock("../../src/services/events/dispatch", () => ({
	dispatchEvents: mocks.dispatchEvents,
	runEventRetention: mocks.runEventRetention,
}));

import { handleOrganizationPurgeCron, isCronAuthorized } from "../../src/api/cron";
import { handleEventDispatch, handleEventRetention } from "../../src/api/events";

const secret = "test-secret";

const cronRequest = ({ authorization }: { authorization?: string }) =>
	new Request("https://example.test/api/cron", {
		headers: authorization === undefined ? {} : { authorization },
	});

const eventRequest = ({
	authorized = true,
	body,
	method = "POST",
}: {
	authorized?: boolean;
	body?: string;
	method?: string;
}) =>
	new Request("https://example.test/api/events/dispatch", {
		body,
		headers: authorized ? { authorization: `Bearer ${secret}` } : {},
		method,
	});

const postJson = (value: { eventIds: Array<string>; extra?: boolean }) => eventRequest({ body: JSON.stringify(value) });

beforeEach(() => {
	vi.stubEnv("CRON_SECRET", secret);
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.clearAllMocks();
});

describe("isCronAuthorized", () => {
	it.each([undefined, "Bearer wrong-secret", "Bearer test-secret-longer", secret, `bearer ${secret}`])(
		"rejects %j",
		(authorization) => {
			expect(isCronAuthorized(cronRequest({ authorization }))).toBe(false);
		}
	);

	it.each(["Bearer ", "Bearer undefined"])("fails closed without CRON_SECRET for %j", (authorization) => {
		vi.stubEnv("CRON_SECRET", "");
		expect(isCronAuthorized(cronRequest({ authorization }))).toBe(false);
	});

	it("accepts the exact bearer secret", () => {
		expect(isCronAuthorized(cronRequest({ authorization: `Bearer ${secret}` }))).toBe(true);
	});
});

describe("handleEventDispatch", () => {
	it("rejects an unauthorized sweep", async () => {
		const response = await handleEventDispatch(eventRequest({ authorized: false, method: "GET" }));

		expect(response.status).toBe(401);
		expect(mocks.dispatchEvents).not.toHaveBeenCalled();
	});

	it("runs the sweep for an authorized GET", async () => {
		const response = await handleEventDispatch(eventRequest({ method: "GET" }));

		expect(response.status).toBe(200);
		expect(mocks.dispatchEvents).toHaveBeenCalledWith();
	});

	it("rejects an unauthorized wake-up before reading the body", async () => {
		const response = await handleEventDispatch(
			eventRequest({ authorized: false, body: JSON.stringify({ eventIds: [randomUUID()] }) })
		);

		expect(response.status).toBe(401);
		expect(mocks.dispatchEvents).not.toHaveBeenCalled();
	});

	it("dispatches the requested events", async () => {
		const eventIds = [randomUUID()];
		const response = await handleEventDispatch(postJson({ eventIds }));

		expect(response.status).toBe(200);
		expect(mocks.dispatchEvents).toHaveBeenCalledWith({ eventIds });
	});

	it.each([
		["an empty array", () => postJson({ eventIds: [] })],
		["more than 100 ids", () => postJson({ eventIds: Array.from({ length: 101 }, () => randomUUID()) })],
		["non-uuid ids", () => postJson({ eventIds: ["not-a-uuid"] })],
		["extra keys", () => postJson({ eventIds: [randomUUID()], extra: true })],
		["a non-JSON body", () => eventRequest({ body: "not json" })],
		["a missing body", () => eventRequest({})],
	])("returns 400 for %s", async (_name, build) => {
		const response = await handleEventDispatch(build());

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: { message: "Invalid dispatch request" } });
		expect(mocks.dispatchEvents).not.toHaveBeenCalled();
	});
});

describe("handleEventRetention", () => {
	it("rejects an unauthorized request", async () => {
		const response = await handleEventRetention(eventRequest({ authorized: false, method: "GET" }));

		expect(response.status).toBe(401);
		expect(mocks.runEventRetention).not.toHaveBeenCalled();
	});

	it("runs retention when authorized", async () => {
		const response = await handleEventRetention(eventRequest({ method: "GET" }));

		expect(response.status).toBe(200);
		expect(mocks.runEventRetention).toHaveBeenCalledTimes(1);
	});
});

describe("handleOrganizationPurgeCron", () => {
	it("rejects an unauthorized sweep", async () => {
		const response = await handleOrganizationPurgeCron(cronRequest({ authorization: "Bearer wrong-secret" }));

		expect(response.status).toBe(401);
		expect(mocks.sweepOrganizationPurges).not.toHaveBeenCalled();
	});

	it("runs the purge sweep when authorized", async () => {
		const response = await handleOrganizationPurgeCron(cronRequest({ authorization: `Bearer ${secret}` }));

		expect(await response.json()).toEqual({ cancelled: 0, completed: 1, failed: 0 });
		expect(mocks.sweepOrganizationPurges).toHaveBeenCalledOnce();
	});
});
