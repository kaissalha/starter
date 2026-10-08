import { sectionDefinitions } from "../section-registry";
import type { SectionDefinition } from "../sections/section-definition";
import type { WebsiteBriefV1 } from "./contracts";
import {
	createPageSlots,
	rankWebsiteGenerationProfiles,
	websiteGenerationProfiles,
	websiteGenerationSectionDefinitions,
	type GenerationSectionSlot,
	type WebsiteGenerationProfile,
} from "./profiles";

const visualBusiness =
	/(?:\b(?:food|restaurant|cafe|coffee|bakery|photography|film|design|florist|garden|landscaping|construction|carpentry|hair|beauty|fitness|gym|retail|fashion|craft|ceramics|hotel|property|real estate)\b|مطعم|مقهى|قهوة|مخبز|تصوير|تصميم|زهور|حدائق|بناء|نجارة|تجميل|لياقة|ملابس|عقارات)/iu;

const visualWritingVoices = [
	"Warm, observant, and concrete. Describe tangible details with short sentences. Avoid hype and luxury clichés.",
	"Lively and sensory, but plain-spoken. Lead with what people see, taste, or feel, in short sentences. Avoid hype and clichés.",
	"Relaxed and neighbourly. Write the way the people doing the work would speak, with concrete details. Avoid slogans and superlatives.",
	"Crisp and confident. Use short declarative sentences and specific nouns. Avoid exclamation marks, hype, and luxury clichés.",
];

const advisoryWritingVoices = [
	"Calm, precise, and approachable. Explain practical questions in plain language. Avoid jargon, superlatives, and guarantees.",
	"Direct and reassuring. Address the reader's likely concern first, then explain plainly. Avoid jargon, superlatives, and guarantees.",
	"Friendly and conversational, like a knowledgeable neighbour. Use everyday words and short paragraphs. Avoid jargon, hype, and guarantees.",
	"Measured and exact. Prefer specific nouns to adjectives and keep each sentence to one idea. Avoid jargon, superlatives, and guarantees.",
];

const generationHeaderPatterns = [
	"header-basic",
	"header-detached-transparent",
	"header-flush-transparent",
	"header-marketer",
	"header-pill-nav",
];

const generationFooterPatterns = [
	"footer-detached",
	"footer-editorial-split",
	"footer-info-grid",
	"footer-logo-nav",
	"footer-pill-nav",
];

const templatePatternCounts = websiteGenerationProfiles
	.flatMap(({ sections }) => sections.map(({ pattern }) => pattern))
	.reduce((counts, pattern) => counts.set(pattern, (counts.get(pattern) ?? 0) + 1), new Map<string, number>());

export const generationSeedHash = (seed: string) =>
	[...seed].reduce((hash, character) => Math.imul(hash ^ character.codePointAt(0)!, 16_777_619) >>> 0, 2_166_136_261);

export const drawNearBest = <Candidate>({
	candidates,
	seed,
	weight,
}: {
	candidates: ReadonlyArray<Candidate>;
	seed: string;
	weight: (candidate: Candidate) => number;
}) => {
	const weighted = candidates.map((candidate) => ({ candidate, weight: weight(candidate) }));
	const best = Math.max(0, ...weighted.map((entry) => entry.weight));
	const pool = weighted.filter((entry) => entry.weight > 0 && entry.weight >= best / 2);

	const cursor = {
		remaining: (generationSeedHash(seed) / 2 ** 32) * pool.reduce((sum, entry) => sum + entry.weight, 0),
	};

	return (
		pool.find((entry) => {
			cursor.remaining -= entry.weight;

			return cursor.remaining < 0;
		}) ?? pool.at(-1)
	)?.candidate;
};

const isVisualBusiness = ({ type }: Pick<WebsiteBriefV1, "type">) =>
	visualBusiness.test(type.normalize("NFKD").replaceAll(/\p{M}/gu, ""));

export const websiteWritingVoice = ({
	brief,
}: {
	brief: Pick<WebsiteBriefV1, "location" | "name" | "type" | "voice">;
}) => {
	if (brief.voice) {
		return brief.voice;
	}

	const voices = isVisualBusiness(brief) ? visualWritingVoices : advisoryWritingVoices;

	return voices[generationSeedHash(`${brief.name}:${brief.type}:${brief.location}:voice`) % voices.length]!;
};

export const resolveWebsiteGenerationProfile = ({
	brief,
	templateId = "custom",
}: {
	brief: WebsiteBriefV1;
	templateId?: string;
}): WebsiteGenerationProfile => {
	if (templateId !== "custom") {
		const profile = websiteGenerationProfiles.find((candidate) => candidate.templateId === templateId);

		if (!profile) {
			throw new Error(`Website generation profile "${templateId}" is missing`);
		}

		return profile;
	}

	const visual = isVisualBusiness(brief);

	const sections = websiteGenerationSectionDefinitions.filter(
		(definition) => !definition.pattern.startsWith("blog-latest") && (visual || definition.category !== "gallery")
	);

	const seed = `${brief.name}:${brief.type}:${brief.location}`;

	const tradePatterns = new Set(
		rankWebsiteGenerationProfiles({ businessType: brief.type })
			.filter(({ score }) => score > 0)
			.flatMap(({ profile }) => [...profile.sections, ...profile.layout.header, ...profile.layout.footer])
			.map((entry) => ("definition" in entry ? entry.definition.pattern : entry.pattern))
	);

	const weight = ({ pattern }: SectionDefinition) =>
		(tradePatterns.has(pattern) ? 1.5 : 1) * ((templatePatternCounts.get(pattern) ?? 0) >= 4 ? 0.35 : 1);

	const siteUsed = new Set<SectionDefinition>();
	const offeringPage = brief.menu?.length ? "menu" : "services";
	const proofPage = brief.portfolio?.length ? "portfolio" : "faq";

	const recipes = {
		about: [
			{
				categories: ["hero"],
				purpose:
					"Introduce the business's point of view, without inventing a history or repeating the homepage introduction.",
			},
			{
				categories: ["content"],
				purpose:
					"Explain the business's approach using confirmed details. Do not invent founders, dates, awards, clients, or credentials.",
			},
			{
				categories: ["call-to-action"],
				purpose: "Invite visitors to discuss whether the business is a fit for their needs.",
			},
		],
		contact: [
			{
				categories: ["hero"],
				purpose:
					"Invite visitors to send an inquiry using the contact form below. Do not promise a reply time.",
			},
			{ categories: ["contact"], purpose: "Send a message through the working contact form." },
		],
		home: [
			{
				categories: ["hero"],
				purpose:
					"Introduce the business type and location. State what visitors can explore here; save details for the following sections.",
			},
			{
				categories: ["features"],
				purpose:
					"Help visitors understand the broad offering. Use confirmed menu or service details when supplied. Do not repeat the introductory promise.",
			},
			{
				categories: [visual ? "gallery" : "content"],
				purpose: visual
					? "Introduce the visual character of this business type. Stock imagery is illustrative, never evidence of this business's actual premises, products, team, or completed work."
					: "Explain what information a customer can bring to a first conversation. Do not invent a fixed process.",
			},
			{
				categories: ["call-to-action"],
				purpose: "Invite an inquiry through Contact. Do not introduce new claims or repeat the offering list.",
			},
		],
		[offeringPage]: [
			{
				categories: ["hero"],
				purpose: brief.menu?.length
					? "Introduce the supplied menu without claiming ordering, delivery, availability, or prices not supplied."
					: "Frame the customer needs this business type addresses, without inventing named packages.",
			},
			{
				categories: ["features", "content"],
				purpose: brief.menu?.length
					? "Present only the actual menu items supplied in the brief. Never invent dishes, ingredients, prices, or dietary claims."
					: "Explain the supplied services or broad capabilities implied by the business type. Do not invent products or packages.",
			},
			{
				categories: ["call-to-action"],
				purpose:
					"Invite questions about the offering through Contact; this is an inquiry, not an order or booking.",
			},
		],
		[proofPage]: [
			{
				categories: ["hero"],
				purpose: brief.portfolio?.length
					? "Introduce the actual work descriptions supplied by the business, without adding results or client names."
					: "Introduce practical questions a visitor might have, without repeating the service overview.",
			},
			{
				categories: [brief.portfolio?.length ? "content" : "faq"],
				purpose: brief.portfolio?.length
					? "Describe only supplied portfolio facts. Do not represent stock imagery as completed work or invent case studies."
					: "Answer distinct practical questions using confirmed facts. For unknown policies or availability, invite an inquiry rather than guessing.",
			},
			{
				categories: ["call-to-action"],
				purpose: "Invite visitors to ask a question not addressed on this page.",
			},
		],
	};

	const layoutSlot = (area: "header" | "footer", patterns: Array<string>): GenerationSectionSlot => {
		const definition = drawNearBest({
			candidates: sectionDefinitions.filter((section) => patterns.includes(section.pattern)),
			seed: `${seed}:${area}`,
			weight,
		});

		if (!definition) {
			throw new Error(`Generation ${area} patterns are missing`);
		}

		return {
			area,
			definition,
			index: 0,
			purpose: "Identify the business and navigate to the available pages.",
			required: true,
			slotKey: `layout.${area}`,
		};
	};

	return {
		keywords: [brief.type],
		layout: {
			footer: [layoutSlot("footer", generationFooterPatterns)],
			header: [layoutSlot("header", generationHeaderPatterns)],
		},
		name: "Custom",
		pages: Object.fromEntries(
			["home", "about", offeringPage, proofPage, "contact"].map((pageKey) => [
				pageKey,
				{
					slots: createPageSlots({
						draw: ({ candidates, index }) =>
							drawNearBest({ candidates, seed: `${seed}:${pageKey}:${index}`, weight }),
						pageKey,
						recipes: recipes[pageKey]!,
						sections,
						siteUsed,
					}),
					slug: pageKey,
				},
			])
		),
		sections,
		templateId: "custom",
	};
};
