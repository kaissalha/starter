import { timingSafeEqual } from "node:crypto";

import { pruneExpiredAuthRecords, pruneMastraStorage, pruneStaleOAuthClients } from "../services/data-retention";
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

export const unauthorizedCron = () => Response.json({ error: { message: "Unauthorized" } }, { status: 401 });

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
