import { timingSafeEqual } from "node:crypto";

import {
	pruneExpiredAuthRecords,
	pruneMastraStorage,
	pruneSeoAnswerRuns,
	pruneStaleOAuthClients,
	pruneWebsiteVersions,
} from "../services/data-retention";
import { sweepOrganizationPurges } from "../services/organization-purge";
import { syncDomainRegistrations } from "../services/websites/domain-registrations";
import { reconcilePendingDomains } from "../services/websites/domains";

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

export const handleDomainCron = async (request: Request) => {
	if (!isCronAuthorized(request)) {
		return unauthorizedCron();
	}

	const job = new URL(request.url).pathname.split("/").at(-1);

	if (job === "reconcile") {
		return Response.json(await reconcilePendingDomains());
	}

	if (job === "registrations") {
		return Response.json(await syncDomainRegistrations());
	}

	return Response.json({ error: { message: "Unknown domain job" } }, { status: 404 });
};

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
		seoAnswerRuns: await pruneSeoAnswerRuns(),
		websiteVersions: await pruneWebsiteVersions(),
	});
};
