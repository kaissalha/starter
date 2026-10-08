import type { WebsiteSnapshotV1 } from "@starter/infinite-website/contracts";
import {
	editWebsiteSnapshots,
	BehaviorSectionError,
	prepareWebsiteEditInputs,
	listSectionLinkElementReferences,
	resolveSectionContentReference,
	stringValueSchema,
	WebsiteEditError,
	type WebsiteEditInput,
} from "@starter/infinite-website/editing";

import { createWebsiteMenuTranslationPrompt, createWebsiteMenuTranslationSchema } from "../../ai/prompts";
import { models } from "../../mastra/models";
import { translateContentFields } from "../content-translation";
import { runWebsiteObjectGeneration, websiteLanguageName } from "./generation-model";
import { prepareWebsiteLanguage } from "./languages";

export class WebsiteTextTranslationError extends Error {
	constructor(options?: ErrorOptions) {
		super("Text translation failed.", options);
		this.name = "WebsiteTextTranslationError";
	}
}

export const prepareWebsiteEdits = async ({
	inputs: rawInputs,
	readSnapshot,
}: {
	inputs: Array<WebsiteEditInput>;
	readSnapshot: () => Promise<Pick<WebsiteSnapshotV1, "brand" | "document">>;
}) => {
	const prepared = await (async () => {
		try {
			return await prepareWebsiteEditInputs(rawInputs);
		} catch (error) {
			throw new WebsiteEditError(error instanceof BehaviorSectionError ? error.message : undefined);
		}
	})();

	const inputs = await Promise.all(
		prepared.map(async (input) =>
			input.operation === "add-language" && !input.content
				? prepareWebsiteLanguage({ input, snapshot: await readSnapshot() })
				: input
		)
	);

	const labelEdits = inputs.filter(
		(input) =>
			input.operation === "add-menu-item" ||
			input.operation === "update-menu-item" ||
			input.operation === "update-link"
	);

	if (!labelEdits.some((input) => input.operation !== "update-link" || input.label !== undefined)) {
		return inputs.some((input) => input.operation === "update-text")
			? translateWebsiteTextEdits({ inputs, snapshot: await readSnapshot() })
			: inputs;
	}

	const edited = editWebsiteSnapshots({ inputs, snapshot: await readSnapshot() });

	const sourceEdits = labelEdits.flatMap((input) => {
		const section = edited.document.structure.layout.header.find(({ id }) => id === input.sectionId);

		if (!section) {
			return [];
		}

		const pointers =
			input.operation === "update-link"
				? (input.label?.pointers ?? [])
				: listSectionLinkElementReferences({ node: section.root })
						.filter((reference) => reference.menuItemId === input.elementId)
						.flatMap(({ labels }) => labels.map(({ pointer }) => pointer));

		return pointers.map((pointer) => ({
			locale: input.locale,
			operation: "update-text" as const,
			pointer,
			sectionId: section.id,
			value: stringValueSchema.parse(
				resolveSectionContentReference({
					content: edited.document.content,
					contentId: section.contentId,
					defaultLocale: edited.document.defaultLocale,
					locale: input.locale,
					reference: { $text: pointer },
				})
			),
		}));
	});

	const unique = [
		...new Map(sourceEdits.map((edit) => [`${edit.sectionId}:${edit.pointer}:${edit.locale}`, edit])).values(),
	];

	const targets = unique.flatMap((source) =>
		edited.document.locales
			.filter(
				(locale) =>
					locale !== source.locale &&
					!unique.some(
						(other) =>
							other.sectionId === source.sectionId &&
							other.pointer === source.pointer &&
							other.locale === locale
					)
			)
			.map((locale) => ({ ...source, locale, sourceLocale: source.locale }))
	);

	if (targets.length === 0) {
		return inputs;
	}

	const fields = targets.map((target, index) => ({
		key: `label${index}`,
		sourceLanguage: websiteLanguageName(target.sourceLocale),
		targetLanguage: websiteLanguageName(target.locale),
		text: target.value,
	}));

	const schema = createWebsiteMenuTranslationSchema(fields.map(({ key }) => key));

	const request = {
		model: models.websiteGeneration.model,
		prompt: createWebsiteMenuTranslationPrompt(fields),
		schema,
		telemetryFunctionId: "website-menu-translation",
	};

	const initial = await runWebsiteObjectGeneration(request);

	const generated =
		initial.status === "repair" ? await runWebsiteObjectGeneration({ ...request, repair: initial }) : initial;

	if (generated.status !== "valid") {
		throw new WebsiteEditError("Menu translation failed. Please try again.");
	}

	const labels = schema.parse(generated.output);

	return [
		...inputs,
		...targets.map(({ sourceLocale: _sourceLocale, ...target }, index) => ({
			...target,
			value: stringValueSchema.parse(labels[`label${index}`]),
		})),
	];
};

const translateWebsiteTextEdits = async ({
	inputs,
	snapshot,
}: {
	inputs: Array<WebsiteEditInput>;
	snapshot: Pick<WebsiteSnapshotV1, "brand" | "document">;
}) => {
	const source = inputs
		.filter((input) => input.operation === "update-text")
		.filter((input) => input.locale === snapshot.document.defaultLocale);

	if (!source.length) {
		return inputs;
	}

	try {
		const translations = await Promise.all(
			snapshot.document.locales
				.filter((locale) => locale !== snapshot.document.defaultLocale)
				.map(async (locale) => {
					const targets = source.filter(
						(edit) =>
							!inputs.some(
								(input) =>
									input.operation === "update-text" &&
									input.locale === locale &&
									input.sectionId === edit.sectionId &&
									input.pointer === edit.pointer
							)
					);

					const values = await translateContentFields({
						fields: targets.map((edit) => edit.value),
						locale,
						sourceLocale: snapshot.document.defaultLocale,
					});

					return targets.map((edit, index) => ({ ...edit, locale, value: values[index]! }));
				})
		);

		return [...inputs, ...translations.flat()];
	} catch (error) {
		throw new WebsiteTextTranslationError({ cause: error });
	}
};
