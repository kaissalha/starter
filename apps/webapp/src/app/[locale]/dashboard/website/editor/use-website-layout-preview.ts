import { useEffect, useRef } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { apiClient, client } from "@/lib/api-client";
import { toast } from "@starter/ui/components/toaster";

import type { WebsiteEditor } from "../use-website-editor";

export const useWebsiteLayoutPreview = ({ editor, websiteId }: { editor: WebsiteEditor; websiteId: string }) => {
	const queryClient = useQueryClient();
	const t = useTranslations("website.layout");
	const abort = useRef<AbortController | null>(null);
	const snapshot = editor.draft?.baselineSnapshot;
	const target = editor.layoutTarget;
	const locale = editor.locale;

	useEffect(
		() => () => {
			abort.current?.abort();
		},
		[locale, snapshot, target]
	);

	const invalidatePreview = () => {
		abort.current?.abort();
	};

	const generatePreview = async (pattern: string) => {
		if (!snapshot || !target) {
			return;
		}

		abort.current?.abort();
		const controller = new AbortController();
		abort.current = controller;

		try {
			const preview = await queryClient.query({
				...apiClient.websites.previewLayout.queryOptions({
					gcTime: 5 * 60 * 1000,
					input: { locale, pattern, snapshot, target, websiteId },
					retry: false,
					staleTime: Infinity,
				}),
				queryFn: ({ signal }) =>
					client.websites.previewLayout(
						{ locale, pattern, snapshot, target, websiteId },
						{ signal: AbortSignal.any([signal, controller.signal]) }
					),
			});

			if (!controller.signal.aborted) {
				editor.previewDraft({ input: null, selection: pattern, snapshot: preview });
			}
		} catch {
			if (!controller.signal.aborted) {
				editor.previewDraft({ input: null, selection: null, snapshot });
				toast.error(t("previewFailed"));
			}
		}
	};

	return { generatePreview, invalidatePreview };
};
