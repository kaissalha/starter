import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
	editWebsiteSnapshots,
	listSectionMenus,
	listSectionLinkElementReferences,
	resolveSectionContentReference,
	type WebsiteEditInput,
} from "@starter/infinite-website/editing";
import {
	createGenerationTemplateBrand,
	websiteGenerationProfiles,
	type Iso6391LanguageCode,
} from "@starter/infinite-website/generation";
import { templatePreviews } from "@starter/infinite-website/template-previews";

import { prepareWebsiteEdits, WebsiteTextTranslationError } from "../../src/services/websites/edit-preparation";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));

vi.mock("../../src/services/websites/generation-model", async (original) => ({
	...(await original<typeof import("../../src/services/websites/generation-model")>()),
	runWebsiteObjectGeneration: generate,
}));

const template = templatePreviews[0];

if (!template) {
	throw new Error("Expected template");
}

const snapshot = {
	...template,
	brand: createGenerationTemplateBrand({ locale: "en", profile: websiteGenerationProfiles[0]! }),
	schemaVersion: 1 as const,
	templateId: template.id,
};

const section = snapshot.document.structure.layout.header[0];

const menu = section && listSectionMenus({ node: section.root })[0];

if (!section || !menu) {
	throw new Error("Expected header navigation");
}

const elementId = crypto.randomUUID();

const input: WebsiteEditInput = {
	elementId,
	index: 0,
	label: "Services",
	locale: "en",
	menuId: menu.id,
	operation: "add-menu-item",
	sectionId: section.id,
	value: { kind: "relative", path: "/services" },
};

beforeEach(() => {
	generate.mockReset().mockResolvedValue({ output: { label0: "خدماتنا" }, status: "valid" });
});

describe("website menu translation", () => {
	it("translates a new label into Arabic without changing the source or destination", async () => {
		const inputs = await prepareWebsiteEdits({ inputs: [input], readSnapshot: async () => snapshot });
		const updated = editWebsiteSnapshots({ inputs, snapshot });
		const pointer = `/authoring/menu/${menu.id}/items/${elementId}/label`;

		for (const [locale, label] of [
			["en", "Services"],
			["ar", "خدماتنا"],
		] as const) {
			expect(
				resolveSectionContentReference({
					content: updated.document.content,
					contentId: section.contentId,
					defaultLocale: updated.document.defaultLocale,
					locale,
					reference: { $text: pointer },
				})
			).toBe(label);
		}

		expect(inputs[0]).toEqual(input);
		expect(generate).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: expect.objectContaining({
					prompt: expect.stringContaining('"targetLanguage":"Arabic"'),
					system: expect.stringContaining("untrusted source data"),
				}),
			})
		);
	});
	it("translates Arabic source labels back into English", async () => {
		generate.mockResolvedValue({ output: { label0: "Services" }, status: "valid" });

		const inputs = await prepareWebsiteEdits({
			inputs: [{ ...input, label: "خدماتنا", locale: "ar" }],
			readSnapshot: async () => snapshot,
		});

		expect(inputs[1]).toMatchObject({ locale: "en", operation: "update-text", value: "Services" });
	});
	it("keeps explicit translations supplied in a batch", async () => {
		const inputs: Array<WebsiteEditInput> = [
			input,
			{
				elementId,
				items: [],
				kind: "link",
				label: "خدماتنا",
				locale: "ar",
				operation: "update-menu-item",
				sectionId: section.id,
				value: { kind: "relative", path: "/services" },
			},
		];

		expect(await prepareWebsiteEdits({ inputs, readSnapshot: async () => snapshot })).toEqual(inputs);
		expect(generate).not.toHaveBeenCalled();
	});
	it("translates edited header button labels and keeps their links", async () => {
		const action = listSectionLinkElementReferences({ node: section.root }).find(
			({ elementType, labels }) => elementType === "action" && labels.length > 0
		);

		if (!action) {
			throw new Error("Expected header action");
		}

		const source: WebsiteEditInput = {
			label: { pointers: action.labels.map(({ pointer }) => pointer), value: "Services" },
			locale: "en",
			operation: "update-link",
			pointer: action.pointer,
			sectionId: section.id,
			value: { kind: "relative", path: "/services" },
		};

		generate.mockResolvedValue({
			output: Object.fromEntries(action.labels.map((_, index) => [`label${index}`, "خدماتنا"])),
			status: "valid",
		});
		const translated = await prepareWebsiteEdits({ inputs: [source], readSnapshot: async () => snapshot });
		expect(translated[0]).toEqual(source);
		expect(translated.slice(1)).toEqual(
			action.labels.map(({ pointer }) => ({
				locale: "ar",
				operation: "update-text",
				pointer,
				sectionId: section.id,
				value: "خدماتنا",
			}))
		);
	});
	it("translates dropdown labels together and rejects incomplete model output", async () => {
		const added = editWebsiteSnapshots({ inputs: [input], snapshot });

		const edit: WebsiteEditInput = {
			elementId,
			items: [{ id: crypto.randomUUID(), label: "Contact us", value: { kind: "relative", path: "/contact" } }],
			kind: "dropdown",
			label: "Services",
			locale: "en",
			operation: "update-menu-item",
			sectionId: section.id,
			value: { kind: "relative", path: "/services" },
		};

		generate.mockResolvedValue({ output: { label0: "خدماتنا", label1: "تواصل معنا" }, status: "valid" });
		const translated = await prepareWebsiteEdits({ inputs: [edit], readSnapshot: async () => added });
		expect(translated.slice(1).map((entry) => entry.operation === "update-text" && entry.value)).toEqual([
			"خدماتنا",
			"تواصل معنا",
		]);
		expect(() => editWebsiteSnapshots({ inputs: translated, snapshot: added })).not.toThrow();
		generate.mockResolvedValue({ output: { label0: "خدماتنا" }, status: "valid" });
		await expect(prepareWebsiteEdits({ inputs: [edit], readSnapshot: async () => added })).rejects.toThrow(
			"expected string"
		);
	});
	it("does not load a translation snapshot for a non-label edit", async () => {
		const readSnapshot = vi.fn();
		const existing = menu.props.items[0];

		if (!existing) {
			throw new Error("Expected menu item");
		}

		const inputs: Array<WebsiteEditInput> = [
			{ elementId: existing.id, index: 0, operation: "move-menu-item", sectionId: section.id },
		];

		expect(await prepareWebsiteEdits({ inputs, readSnapshot })).toEqual(inputs);
		expect(readSnapshot).not.toHaveBeenCalled();
	});

	it("propagates provider failure", async () => {
		generate.mockRejectedValue(new Error("provider unavailable"));
		await expect(prepareWebsiteEdits({ inputs: [input], readSnapshot: async () => snapshot })).rejects.toThrow(
			"provider unavailable"
		);
	});
});

const locales: Array<Iso6391LanguageCode> = [snapshot.document.defaultLocale, "ar", "fr"];

const textSnapshot = { ...snapshot, document: { ...snapshot.document, locales } };

const textInput: WebsiteEditInput = {
	locale: snapshot.document.defaultLocale,
	operation: "update-text",
	pointer: "/heading",
	sectionId: crypto.randomUUID(),
	value: "Hello",
};

describe("website text edit translation", () => {
	const translateEcho = async ({ prompt }: { prompt: { prompt: string } }) => {
		const request = z
			.object({ fields: z.record(z.string(), z.string()), targetLocale: z.string() })
			.parse(JSON.parse(prompt.prompt));

		return {
			output: Object.fromEntries(
				Object.entries(request.fields).map(([key, text]) => [key, `${request.targetLocale}:${text}`])
			),
			status: "valid" as const,
		};
	};

	beforeEach(() => {
		generate.mockReset().mockImplementation(translateEcho);
	});

	it("translates every other locale concurrently and keeps locale order", async () => {
		const started = Promise.withResolvers<void>();
		generate.mockImplementation(async (options: { prompt: { prompt: string } }) => {
			if (generate.mock.calls.length === 2) {
				started.resolve();
			}

			await started.promise;

			return translateEcho(options);
		});

		await expect(
			prepareWebsiteEdits({ inputs: [textInput], readSnapshot: async () => textSnapshot })
		).resolves.toEqual([
			textInput,
			{ ...textInput, locale: "ar", value: "ar:Hello" },
			{ ...textInput, locale: "fr", value: "fr:Hello" },
		]);
	});

	it("does not translate a locale that has an explicit edit in the same batch", async () => {
		const explicitArabicEdit = { ...textInput, locale: "ar" as const, value: "مرحبا" };

		await expect(
			prepareWebsiteEdits({ inputs: [textInput, explicitArabicEdit], readSnapshot: async () => textSnapshot })
		).resolves.toEqual([textInput, explicitArabicEdit, { ...textInput, locale: "fr", value: "fr:Hello" }]);
		expect(generate).toHaveBeenCalledOnce();
	});

	it("reports a translation failure as a typed error", async () => {
		generate.mockRejectedValue(new Error("gateway down"));

		const prepared = prepareWebsiteEdits({ inputs: [textInput], readSnapshot: async () => textSnapshot });

		await expect(prepared).rejects.toBeInstanceOf(WebsiteTextTranslationError);
		await expect(prepared).rejects.toMatchObject({ cause: { message: "gateway down" } });
	});
});
