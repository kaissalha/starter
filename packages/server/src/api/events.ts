import { z } from "zod";

import { dispatchEvents, runEventRetention } from "../services/events/dispatch";
import { isCronAuthorized, unauthorizedCron } from "./cron";

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
