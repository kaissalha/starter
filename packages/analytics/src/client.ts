import { Tinybird } from "@tinybirdco/sdk";

import {
	analyticsBreakdown,
	analyticsHourly,
	analyticsLive,
	analyticsOverview,
	analyticsRealtime,
	analyticsWebVitals,
} from "./endpoints";
import { analyticsEvents } from "./resources";

export class AnalyticsUnavailableError extends Error {
	constructor() {
		super("Analytics is unavailable.");
		this.name = "AnalyticsUnavailableError";
	}
}

export const getAnalyticsConfiguration = (purpose: "read" | "append") => {
	const token = process.env[purpose === "read" ? "TINYBIRD_READ_TOKEN" : "TINYBIRD_APPEND_TOKEN"];
	const baseUrl = process.env.TINYBIRD_URL;

	if (!token || !baseUrl || process.env.TINYBIRD_BRANCH_TOKEN) {
		return null;
	}

	return { baseUrl, token };
};

export const createAnalyticsClient = (purpose: "read" | "append") => {
	const config = getAnalyticsConfiguration(purpose);

	if (!config) {
		throw new AnalyticsUnavailableError();
	}

	return new Tinybird({
		...config,
		datasources: { analyticsEvents },
		devMode: false,
		fetch: (url, init) => fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(5000) }),
		pipes: {
			analyticsBreakdown,
			analyticsHourly,
			analyticsLive,
			analyticsOverview,
			analyticsRealtime,
			analyticsWebVitals,
		},
	});
};
