import { z } from "zod";

import type { SiteDocument } from "../document/site-document-schema";
import type { Iso6391LanguageCode } from "../language-codes";

export const blogLabelsSchema = z.object({
	back: z.string().min(1).max(200),
	empty: z.string().min(1).max(500),
	next: z.string().min(1).max(200),
	previous: z.string().min(1).max(200),
	title: z.string().min(1).max(200),
});

export const getBlogLabels = ({ document, locale }: { document?: SiteDocument; locale: Iso6391LanguageCode }) =>
	document?.content[locale]?.site.blog ??
	(locale === "ar"
		? {
				back: "العودة إلى المدونة",
				empty: "لا توجد مقالات منشورة بعد.",
				next: "التالي",
				previous: "السابق",
				title: "المدونة",
			}
		: {
				back: "Back to Blog",
				empty: "No posts published yet.",
				next: "Next",
				previous: "Previous",
				title: "Blog",
			});
