"use client";

import { useLocale } from "next-intl";

import { WebsiteScaledPreview } from "@/components/website-scaled-preview";
import { SiteRenderer } from "@starter/infinite-website";
import type { WebsiteSnapshotV1 } from "@starter/infinite-website/contracts";
import "@starter/infinite-website/styles.css";
import { cn } from "@starter/ui/lib/utils";

export const WebsiteDraftPreviewFrame = ({ mobile, preview }: { mobile: boolean; preview: WebsiteSnapshotV1 }) => {
	const locale = useLocale();
	const { document } = preview;

	return (
		<WebsiteScaledPreview
			className={cn("rounded-lg", mobile && "mx-auto w-[234px]")}
			fitContent
			scale={mobile ? "sixTenths" : "quarter"}
		>
			<SiteRenderer
				assets={preview.assets}
				brand={preview.brand}
				document={document}
				locale={document.locales.find((candidate) => candidate === locale)}
				preview
			/>
		</WebsiteScaledPreview>
	);
};
