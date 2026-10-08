import { z } from "zod";

import { getBrandFont } from "./fonts/catalog";
import { canonicalLocaleKeySchema, localeSchema } from "./localization";

const scriptPattern = /^[A-Za-z]{4}$/;

const canonicalizeScript = ({ script }: { script: string }) => {
	return `${script[0]?.toUpperCase() ?? ""}${script.slice(1).toLowerCase()}`;
};

export const scriptSchema = z.compile(
	z
		.string()
		.regex(scriptPattern, "Must be a four-letter ISO 15924 script code")
		.overwrite((script) => canonicalizeScript({ script }))
		.meta({ examples: ["Latn", "Arab"], id: "BrandScript" })
);

const canonicalScriptKeySchema = z
	.string()
	.regex(scriptPattern, "Must be a four-letter ISO 15924 script code")
	.refine((script) => canonicalizeScript({ script }) === script, "Script record keys must use canonical casing");

export const brandFontSelectionSchema = z.compile(
	z
		.strictObject({
			axes: z
				.record(z.string().regex(/^[A-Za-z]{4}$/, "Must be a four-letter OpenType axis tag"), z.number())
				.optional(),
			fontId: z.string().regex(/^[a-z\d]+(?:-[a-z\d]+)*$/, "Must be a stable kebab-case font ID"),
			weight: z.number().min(1).max(1000),
		})
		.superRefine((selection, context) => {
			const font = getBrandFont({ fontId: selection.fontId });

			if (!font) {
				context.addIssue({
					code: "custom",
					message: `Unknown Brand font "${selection.fontId}"`,
					path: ["fontId"],
				});

				return;
			}

			if (selection.weight < font.weight.min || selection.weight > font.weight.max) {
				context.addIssue({
					code: "custom",
					message: `Weight must be between ${font.weight.min} and ${font.weight.max} for ${selection.fontId}`,
					path: ["weight"],
				});
			}

			Object.entries(selection.axes ?? {}).forEach(([axis, value]) => {
				const supportedAxis = font.axes[axis];

				if (!supportedAxis) {
					context.addIssue({
						code: "custom",
						message: `Axis "${axis}" is not available for ${selection.fontId}`,
						path: ["axes", axis],
					});

					return;
				}

				if (value < supportedAxis.min || value > supportedAxis.max) {
					context.addIssue({
						code: "custom",
						message: `Axis "${axis}" must be between ${supportedAxis.min} and ${supportedAxis.max}`,
						path: ["axes", axis],
					});
				}
			});
		})
		.meta({ id: "BrandFontSelection" })
);

export const brandFontRoleSchema = z.compile(
	z
		.strictObject({
			default: brandFontSelectionSchema,
			locales: z.record(canonicalLocaleKeySchema, brandFontSelectionSchema).optional(),
			scripts: z.record(canonicalScriptKeySchema, brandFontSelectionSchema).optional(),
		})
		.superRefine((role, context) => {
			Object.entries(role.scripts ?? {}).forEach(([script, selection]) => {
				const font = getBrandFont({ fontId: selection.fontId });

				if (font && !font.scripts.includes(script)) {
					context.addIssue({
						code: "custom",
						message: `${selection.fontId} does not support the ${script} script`,
						path: ["scripts", script, "fontId"],
					});
				}
			});

			Object.entries(role.locales ?? {}).forEach(([locale, selection]) => {
				const script = new Intl.Locale(locale).maximize().script;
				const font = getBrandFont({ fontId: selection.fontId });

				if (script && font && !font.scripts.includes(script)) {
					context.addIssue({
						code: "custom",
						message: `${selection.fontId} does not support the ${script} script used by ${locale}`,
						path: ["locales", locale, "fontId"],
					});
				}
			});
		})
		.meta({ id: "BrandFontRole" })
);

export type BrandFontSelection = z.infer<typeof brandFontSelectionSchema>;

export type BrandFontRole = z.infer<typeof brandFontRoleSchema>;

export const resolveBrandFontSelection = ({
	locale,
	role,
	script,
}: {
	locale: string;
	role: BrandFontRole;
	script?: string;
}) => {
	const canonicalLocale = localeSchema.parse(locale);
	const localeSelection = role.locales?.[canonicalLocale];

	if (localeSelection) {
		return localeSelection;
	}

	const baseLocale = new Intl.Locale(canonicalLocale).language;
	const baseLocaleSelection = role.locales?.[baseLocale];

	if (baseLocaleSelection) {
		return baseLocaleSelection;
	}

	const canonicalScript = script ? scriptSchema.parse(script) : new Intl.Locale(canonicalLocale).maximize().script;
	const scriptSelection = canonicalScript ? role.scripts?.[canonicalScript] : undefined;

	return scriptSelection ?? role.default;
};
