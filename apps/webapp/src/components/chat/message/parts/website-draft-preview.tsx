"use client";

import { useState } from "react";

import dynamic from "next/dynamic";

import { useQuery } from "@tanstack/react-query";

import { EditorViewportToggle } from "@/app/[locale]/dashboard/components/editor/editor-viewport-toggle";
import { apiClient } from "@/lib/api-client";
import { Skeleton } from "@starter/ui/components/skeleton";

const WebsiteDraftPreviewFrame = dynamic(
	async () => (await import("./website-draft-preview-frame")).WebsiteDraftPreviewFrame,
	{ loading: () => <Skeleton className='h-32 w-full' /> }
);

const previewViewports = ["desktop", "mobile"] as const;

export const WebsiteDraftPreview = ({
	input,
	tool,
}: {
	input: { revision: string };
	tool: "buildWebsite" | "composeWebsiteSection";
}) => {
	const [viewport, setViewport] = useState<(typeof previewViewports)[number]>("desktop");

	const { data, isPending } = useQuery(
		apiClient.websites.previewSection.queryOptions({
			gcTime: 5 * 60 * 1000,
			input: { input, tool },
			refetchOnWindowFocus: false,
			retry: false,
			staleTime: Infinity,
		})
	);

	if (isPending) {
		return <Skeleton className='mt-2 h-32 w-full' />;
	}

	if (!data) {
		return null;
	}

	return (
		<div className='mt-2 flex flex-col gap-2'>
			<div className='flex justify-end'>
				<EditorViewportToggle onViewportChange={setViewport} viewport={viewport} viewports={previewViewports} />
			</div>
			<div className='max-h-80 overflow-y-auto rounded-xl bg-background smooth-shadow-ring-sm'>
				<WebsiteDraftPreviewFrame mobile={viewport === "mobile"} preview={data} />
			</div>
		</div>
	);
};
