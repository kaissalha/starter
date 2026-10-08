"use client";

import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";

import { type QueryClient, type QueryKey, useIsFetching, useQueryClient } from "@tanstack/react-query";

import { client } from "@/lib/api-client";
import type { WebsiteSnapshotV1 } from "@starter/infinite-website/generation";

type TemplatePreviewInput = {
	locale: WebsiteSnapshotV1["document"]["defaultLocale"];
	templateId: string;
	websiteId: string;
};

type TemplatePreviewRequest = { controller: AbortController; input: TemplatePreviewInput; queryKey: QueryKey };

const cancelTemplatePreview = ({
	queryClient,
	request,
}: {
	queryClient: QueryClient;
	request: TemplatePreviewRequest | null;
}) => {
	request?.controller.abort();

	if (request) {
		queryClient.cancelQueries({ queryKey: request.queryKey });
	}
};

const fetchTemplatePreview = async ({
	baselineSnapshot,
	input,
	onSkeleton,
	queryClient,
	signal,
}: {
	baselineSnapshot: WebsiteSnapshotV1;
	input: TemplatePreviewInput;
	onSkeleton: (snapshot: WebsiteSnapshotV1) => void;
	queryClient: QueryClient;
	signal: AbortSignal;
}) => {
	const options = {
		gcTime: 5 * 60 * 1000,
		retry: false,
		staleTime: Number.POSITIVE_INFINITY,
	};

	const generatedKey = ["website-template-preview", input, "generated", baselineSnapshot];

	if (!queryClient.getQueryData(generatedKey)) {
		const skeleton = await queryClient.query({
			...options,
			queryFn: ({ signal: querySignal }) =>
				client.websites.previewTemplate(
					{ ...input, mode: "skeleton" },
					{ signal: AbortSignal.any([signal, querySignal]) }
				),
			queryKey: ["website-template-preview", input, "skeleton", baselineSnapshot],
		});

		signal.throwIfAborted();
		onSkeleton(skeleton);
	}

	const snapshot = await queryClient.query({
		...options,
		queryFn: ({ signal: querySignal }) =>
			client.websites.previewTemplate(
				{ ...input, mode: "generated" },
				{ signal: AbortSignal.any([signal, querySignal]) }
			),
		queryKey: generatedKey,
	});

	signal.throwIfAborted();

	return snapshot;
};

export const useWebsiteTemplatePreview = ({
	baselineSnapshot,
	locale,
	onPreview,
	websiteId,
}: {
	baselineSnapshot: WebsiteSnapshotV1;
	locale: WebsiteSnapshotV1["document"]["defaultLocale"];
	onPreview: (snapshot: WebsiteSnapshotV1) => void;
	websiteId: string;
}) => {
	const [selectedTemplateId, setSelectedTemplateId] = useState(baselineSnapshot.templateId);
	const activeRequest = useRef<TemplatePreviewRequest | null>(null);
	const queryClient = useQueryClient();

	const fetching = useIsFetching({
		queryKey: ["website-template-preview", { locale, templateId: selectedTemplateId, websiteId }],
	});

	const abortPreview = () => {
		cancelTemplatePreview({ queryClient, request: activeRequest.current });
		activeRequest.current = null;
	};

	const requestPreview = async (templateId: string) => {
		abortPreview();
		const controller = new AbortController();
		const input = { locale, templateId, websiteId };
		activeRequest.current = { controller, input, queryKey: ["website-template-preview", input] };

		try {
			const snapshot = await fetchTemplatePreview({
				baselineSnapshot,
				input,
				onSkeleton: (skeleton) => startTransition(() => onPreview(skeleton)),
				queryClient,
				signal: controller.signal,
			});

			controller.signal.throwIfAborted();
			startTransition(() => onPreview(snapshot));
		} catch {
			return;
		}
	};

	const refreshPreview = useEffectEvent(() => {
		const request = activeRequest.current;

		if (request && request.input.locale !== locale) {
			requestPreview(request.input.templateId);
		}

		return () => cancelTemplatePreview({ queryClient, request: activeRequest.current });
	});

	useEffect(() => refreshPreview(), [locale]);

	return {
		abortPreview,
		generatingTemplateId: fetching > 0 ? selectedTemplateId : null,
		previewTemplate: (templateId: string) => {
			setSelectedTemplateId(templateId);

			if (templateId === baselineSnapshot.templateId) {
				abortPreview();
				onPreview(baselineSnapshot);

				return;
			}

			requestPreview(templateId);
		},
		selectedTemplateId,
	};
};
