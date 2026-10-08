"use client";

import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { apiClient, client } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import type { SeoOverview } from "@starter/server/api";

export type SeoGeoSample = Awaited<ReturnType<typeof client.seo.geoOverview>>["samples"][number];

export type SeoGeoStep = {
	done: boolean;
	earned: number;
	id: "ai" | "domain" | "pages" | "publish" | "search";
	minutes: number;
	points: number;
};

const bands = [
	{ band: "highlyVisible", min: 65 },
	{ band: "visible", min: 45 },
	{ band: "gettingFound", min: 25 },
	{ band: "low", min: 10 },
	{ band: "notVisible", min: 0 },
] as const;

export type SeoGeoBand = (typeof bands)[number]["band"];

export const countMentions = (samples: Array<SeoGeoSample>) => {
	const answers = samples.flatMap((sample) =>
		(sample.result?.results ?? []).flatMap((entry) => (entry.status === "success" ? [entry.brandMentioned] : []))
	);

	return { mentioned: answers.filter(Boolean).length, total: answers.length };
};

const buildSteps = ({
	overview,
	rate,
	searchReady,
}: {
	overview: SeoOverview;
	rate: number;
	searchReady: boolean;
}): Array<SeoGeoStep> => {
	const published = overview.publishedAt !== null;
	const connected = overview.primaryDomain?.connected === true;

	return [
		{ done: published, earned: published ? 20 : 0, id: "publish", minutes: 1, points: 20 },
		{ done: connected, earned: connected ? 20 : 0, id: "domain", minutes: 10, points: 20 },
		{
			done: published && overview.issues.length === 0,
			earned: published ? Math.max(0, 20 - overview.issues.length * 4) : 0,
			id: "pages",
			minutes: 5,
			points: 20,
		},
		{ done: searchReady, earned: searchReady ? 15 : 0, id: "search", minutes: 2, points: 15 },
		{ done: rate >= 0.5, earned: Math.round(rate * 25), id: "ai", minutes: 15, points: 25 },
	];
};

export const useSeoGeoController = () => {
	const locale: "ar" | "en" = useLocale() === "ar" ? "ar" : "en";
	const overview = useQuery(apiClient.seo.overview.queryOptions(undefined));
	const enabled = Boolean(overview.data?.websiteId);
	const geoOptions = apiClient.seo.geoOverview.queryOptions({ input: { locale } });
	const { can, isLoading: permissionsLoading } = useOrganizationPermissions();
	const canWrite = can("workspace.write");

	const geo = useQuery({
		...geoOptions,
		enabled: enabled && !permissionsLoading,
		queryFn: async ({ signal }) => {
			const current = await client.seo.geoOverview({ locale }, { signal });

			return canWrite &&
				current.business !== null &&
				(current.samples.length === 0 || current.samples.some(({ result }) => result === null))
				? client.seo.seedGeoOverview({ locale }, { signal })
				: current;
		},
		staleTime: 60 * 60 * 1000,
	});

	const search = useQuery({
		...apiClient.seo.searchConsole.queryOptions(undefined),
		enabled,
		staleTime: 30 * 60 * 1000,
	});

	const [connect, setConnect] = useState<"error" | "idle" | "pending">("idle");

	const connectGoogle = async () => {
		setConnect("pending");

		try {
			const result = await authClient.linkSocial({
				callbackURL: "/dashboard/seo-geo",
				provider: "google",
				scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
			});

			setConnect(result.error ? "error" : "idle");
		} catch {
			setConnect("error");
		}
	};

	const mentions = countMentions(geo.data?.samples ?? []);

	const steps = overview.data
		? buildSteps({
				overview: overview.data,
				rate: mentions.total ? mentions.mentioned / mentions.total : 0,
				searchReady: search.data?.status === "available",
			})
		: [];

	const score = Math.min(
		100,
		steps.reduce((sum, step) => sum + step.earned, 0)
	);

	const band = bands.find(({ min }) => score >= min)?.band ?? "notVisible";

	return { band, canWrite, connect, connectGoogle, geo, geoOptions, locale, overview, score, search, steps };
};

export type SeoGeoController = ReturnType<typeof useSeoGeoController>;
