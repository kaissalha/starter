import { getLocale } from "next-intl/server";

import { SiteRenderer } from "@starter/infinite-website";
import { getTemplateBrand, templatePreviews } from "@starter/infinite-website/template-previews";
import { cn } from "@starter/ui/lib/utils";
import "@starter/infinite-brand/fonts.css";
import "@starter/infinite-website/styles.css";

import type { pilotTemplateIds } from "./pilot-templates";

export const TemplatePreview = async ({
	className,
	size,
	templateId,
}: {
	className?: string;
	size: "card" | "detail";
	templateId: (typeof pilotTemplateIds)[number];
}) => {
	const locale = await getLocale();
	const preview = templatePreviews.find(({ id }) => id === templateId);

	if (!preview) {
		throw new Error(`Template preview "${templateId}" is missing`);
	}

	return (
		<div
			aria-hidden='true'
			className={cn(
				"pointer-events-none aspect-video overflow-hidden rounded-2xl bg-white outline outline-olive-200",
				className
			)}
			dir='ltr'
			inert
		>
			<div className={cn("origin-top-left", size === "card" ? "w-[400%] scale-[0.25]" : "w-[200%] scale-50")}>
				<SiteRenderer
					assets={preview.assets}
					brand={getTemplateBrand({ templateId })}
					document={preview.document}
					locale={locale}
				/>
			</div>
		</div>
	);
};
