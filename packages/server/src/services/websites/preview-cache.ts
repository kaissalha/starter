import { z } from "zod";

import { createTCPRedisClient } from "@starter/cache";
import type { Iso6391LanguageCode, WebsiteLayoutGenerationInputV1 } from "@starter/infinite-website/contracts";
import { log } from "@starter/observability";

export type WebsitePreviewScope = {
	organizationId: string;
	revision: string;
	websiteId: string;
};

const fieldsSchema = z.compile(z.array(z.strictObject({ path: z.string(), value: z.string().min(1) })));

type PreviewCacheClient = { value?: ReturnType<typeof createTCPRedisClient> };

const client: PreviewCacheClient = {};

const getClient = () => {
	if (!process.env.REDIS_URL) {
		return null;
	}

	if (!client.value || client.value.status === "end") {
		client.value = createTCPRedisClient(process.env.REDIS_URL, {
			commandTimeout: 500,
			connectTimeout: 500,
			enableOfflineQueue: true,
			maxRetriesPerRequest: 0,
			retryStrategy: () => null,
		});
		client.value.on("error", () => undefined);
	}

	return client.value;
};

export const createWebsiteLayoutPreviewTarget = ({
	input,
	locale,
}: {
	input: Pick<WebsiteLayoutGenerationInputV1, "pattern" | "target">;
	locale: Iso6391LanguageCode;
}) =>
	JSON.stringify([
		"layout",
		input.pattern,
		input.target.area,
		input.target.area === "page" ? input.target.pageId : null,
		input.target.sectionId,
		input.target.index,
		locale,
	]);

const previewKey = ({ scope, target }: { scope: WebsitePreviewScope; target: string }) =>
	`website-preview:v1:${JSON.stringify([scope.organizationId, scope.websiteId, scope.revision, target])}`;

export const readWebsitePreviewFields = async ({
	scope,
	targets,
}: {
	scope: WebsitePreviewScope;
	targets: Array<string>;
}) => {
	const startedAt = Date.now();
	const stats = { hits: 0, unavailable: false };

	try {
		const redis = getClient();

		if (!redis || targets.length === 0) {
			return {};
		}

		const values = await redis.mget(...targets.map((target) => previewKey({ scope, target })));

		return Object.fromEntries(
			values.flatMap((value, index) => {
				if (!value) {
					return [];
				}

				const parsed = fieldsSchema.safeParse(JSON.parse(value));

				if (!parsed.success) {
					return [];
				}

				stats.hits += 1;

				return [[targets[index]!, parsed.data] as const];
			})
		);
	} catch {
		stats.unavailable = true;

		return {};
	} finally {
		log.info({
			cacheHits: stats.hits,
			cacheLookupMs: Date.now() - startedAt,
			cacheTargets: targets.length,
			cacheUnavailable: stats.unavailable,
			message: "Website preview cache lookup settled",
			organizationId: scope.organizationId,
			websiteId: scope.websiteId,
		});
	}
};

export const saveWebsitePreviewFields = async ({
	fields,
	scope,
	target,
}: {
	fields: Array<{ path: string; value: string }>;
	scope: WebsitePreviewScope;
	target: string;
}) => {
	try {
		await getClient()?.set(previewKey({ scope, target }), JSON.stringify(fieldsSchema.parse(fields)), "EX", 1800);
	} catch {
		return;
	}
};
