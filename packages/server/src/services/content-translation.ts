import { z } from "zod";

import { contentTranslationInstructions } from "../ai/prompts";
import { models } from "../mastra/models";
import { runWebsiteObjectGeneration } from "./websites/generation-model";

const translateContentBatch = async ({
	fields,
	locale,
	sourceLocale,
}: {
	fields: Array<string>;
	locale: string;
	sourceLocale: string;
}) => {
	if (!fields.length) {
		return [];
	}

	const schema = z.object(Object.fromEntries(fields.map((_, index) => [`field${index}`, z.string()])));

	const request = {
		model: models.websiteGeneration.model,
		prompt: {
			prompt: JSON.stringify({
				fields: Object.fromEntries(fields.map((text, index) => [`field${index}`, text])),
				sourceLocale,
				targetLocale: locale,
			}),
			system: contentTranslationInstructions,
		},
		schema,
		telemetryFunctionId: "content-translation",
	};

	const result = await runWebsiteObjectGeneration(request);

	const translated =
		result.status === "repair" ? await runWebsiteObjectGeneration({ ...request, repair: result }) : result;

	if (translated.status !== "valid") {
		throw new Error("Translation failed. Please try again.");
	}

	const output = schema.parse(translated.output);

	return fields.map((source, index) => {
		const value = output[`field${index}`];

		if (value === undefined || (source.trim() && !value.trim())) {
			throw new Error("Translation is incomplete. Please try again.");
		}

		return value;
	});
};

export const translateContentFields = async ({
	fields,
	locale,
	sourceLocale,
}: {
	fields: Array<string>;
	locale: string;
	sourceLocale: string;
}): Promise<Array<string>> => {
	const batches = fields.reduce<Array<Array<string>>>((groups, field) => {
		const last = groups.at(-1);

		if (
			!last ||
			last.length >= 40 ||
			last.reduce((length, text) => length + text.length, 0) + field.length > 8000
		) {
			groups.push([field]);
		} else {
			last.push(field);
		}

		return groups;
	}, []);

	const translated: Array<string> = [];

	for (const batch of batches) {
		translated.push(...(await translateContentBatch({ fields: batch, locale, sourceLocale })));
	}

	return translated;
};
