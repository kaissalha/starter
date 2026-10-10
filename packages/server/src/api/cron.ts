import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { pruneExpiredAuthRecords, pruneMastraStorage, pruneStaleOAuthClients } from "../services/data-retention";
import { dispatchEvents, runEventRetention } from "../services/events/dispatch";
import { sweepOrganizationPurges } from "../services/organization-purge";

export const isCronAuthorized = (request: Request) => {
	const secret = process.env.CRON_SECRET;
	const header = request.headers.get("authorization");

	if (!secret || !header) {
		return false;
	}

	const expected = Buffer.from(`Bearer ${secret}`);
	const received = Buffer.from(header);

	return expected.length === received.length && timingSafeEqual(expected, received);
};

const unauthorizedCron = () => Response.json({ error: { message: "Unauthorized" } }, { status: 401 });

export const handleOrganizationPurgeCron = async (request: Request) => {
	if (!isCronAuthorized(request)) {
		return unauthorizedCron();
	}

	return Response.json(await sweepOrganizationPurges());
};

export const handleDataRetention = async (request: Request) => {
	if (!isCronAuthorized(request)) {
		return unauthorizedCron();
	}

	return Response.json({
		authRecords: await pruneExpiredAuthRecords(),
		mastra: await pruneMastraStorage(),
		oauthClients: await pruneStaleOAuthClients(),
	});
};

const dispatchRequestSchema = z.strictObject({ eventIds: z.array(z.uuid()).min(1).max(100) });

const readJson = async (request: Request) => {
	try {
		return await request.json();
	} catch {
		return null;
	}
};

export const handleEventDispatch = async (request: Request) => {
	if (!isCronAuthorized(request)) {
		return unauthorizedCron();
	}

	if (request.method === "GET") {
		return Response.json(await dispatchEvents());
	}

	const body = dispatchRequestSchema.safeParse(await readJson(request));

	if (!body.success) {
		return Response.json({ error: { message: "Invalid dispatch request" } }, { status: 400 });
	}

	return Response.json(await dispatchEvents({ eventIds: body.data.eventIds }));
};

export const handleEventRetention = async (request: Request) => {
	if (!isCronAuthorized(request)) {
		return unauthorizedCron();
	}

	return Response.json(await runEventRetention());
};
