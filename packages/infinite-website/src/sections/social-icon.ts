import { jsonObjectSchema, linkValueSchema, type AuthoringJsonValue } from "../document/content-schema";
import type { IconName } from "../document/structure-schema";

const platforms: Array<{ icon: IconName; pattern: RegExp }> = [
	{ icon: "instagram", pattern: /(?:^|\.)instagram\.com$/u },
	{ icon: "facebook", pattern: /(?:^|\.)(?:facebook|fb)\.com$/u },
	{ icon: "pinterest", pattern: /(?:^|\.)pinterest\.[a-z.]+$/u },
	{ icon: "x", pattern: /(?:^|\.)(?:x|twitter)\.com$/u },
	{ icon: "linkedin", pattern: /(?:^|\.)linkedin\.com$/u },
	{ icon: "youtube", pattern: /(?:^|\.)(?:youtube\.com|youtu\.be)$/u },
];

export const socialIconFromItem = ({ fallback, item }: { fallback: IconName; item?: AuthoringJsonValue }) => {
	const object = jsonObjectSchema.safeParse(item);
	const link = object.success ? linkValueSchema.safeParse(object.data.link) : undefined;

	if (link?.success !== true || link.data.kind !== "external") {
		return fallback;
	}

	const host = URL.parse(link.data.url)?.hostname;

	return platforms.find(({ pattern }) => host !== undefined && pattern.test(host))?.icon ?? fallback;
};
