import { z } from "zod";

import type { LinkValue } from "@starter/infinite-website";
import {
	authoringJsonObjectSchema,
	listSectionContentPointers,
	listSectionRepeaterCollections,
	type AuthoringJsonValue,
	type SectionDefinition,
} from "@starter/infinite-website/generation";

const navigationLabels = {
	ar: {
		about: "من نحن",
		contact: "تواصل معنا",
		faq: "الأسئلة الشائعة",
		home: "الرئيسية",
		menu: "قائمة الطعام",
		portfolio: "أعمالنا",
		services: "خدماتنا",
	},
	en: {
		about: "About us",
		contact: "Contact us",
		faq: "FAQs",
		home: "Home",
		menu: "Menu",
		portfolio: "Our work",
		services: "Our services",
	},
};

export const websiteNavigationLabel = ({ locale, pageKey }: { locale: string; pageKey: string }) =>
	Object.entries(navigationLabels[locale === "ar" ? "ar" : "en"]).find(([key]) => key === pageKey)?.[1] ??
	(locale === "ar" ? "اعرف المزيد" : "Learn more");

export const websiteLinkLabels = ({ link, locale, pageKey }: { link: LinkValue; locale: string; pageKey?: string }) => {
	if (pageKey && (link.kind === "page" || link.kind === "relative")) {
		return [websiteNavigationLabel({ locale, pageKey }), locale === "ar" ? "عرض الصفحة" : "View page"];
	}

	const labels =
		locale === "ar"
			? {
					booking: ["احجز موعدًا", "الحجز"],
					email: ["راسلنا", "أرسل بريدًا إلكترونيًا"],
					external: ["زيارة الموقع", "فتح الموقع"],
					navigation: ["اعرف المزيد", "عرض التفاصيل"],
					phone: ["اتصل بنا", "اتصل الآن"],
				}
			: {
					booking: ["Book an appointment", "Book now"],
					email: ["Email us", "Send an email"],
					external: ["Visit website", "Open website"],
					navigation: ["Learn more", "View details"],
					phone: ["Call us", "Call now"],
				};

	return labels[
		link.kind === "page" || link.kind === "relative" || link.kind === "section" || link.kind === "anchor"
			? "navigation"
			: link.kind
	];
};

const textReferenceSchema = z.compile(z.object({ $text: z.string() }));

const linkReferenceSchema = z.compile(z.object({ $link: z.string() }));

const textPointers = (value: AuthoringJsonValue): Array<string> => {
	if (Array.isArray(value)) {
		return value.flatMap(textPointers);
	}

	const object = authoringJsonObjectSchema.safeParse(value);

	if (!object.success) {
		return [];
	}

	const text = textReferenceSchema.safeParse(value);

	if (text.success) {
		return [text.data.$text];
	}

	return Object.values(object.data).flatMap(textPointers);
};

export const visitWebsiteDefinitionObjects = ({
	collectionItemCounts,
	definition,
	onObject,
}: {
	collectionItemCounts?: ReadonlyMap<string, number>;
	definition: SectionDefinition;
	onObject: (object: z.output<typeof authoringJsonObjectSchema>) => void;
}) => {
	const visit = (value: AuthoringJsonValue): void => {
		if (Array.isArray(value)) {
			value.forEach(visit);

			return;
		}

		const object = authoringJsonObjectSchema.safeParse(value);

		if (!object.success) {
			return;
		}

		onObject(object.data);
		Object.values(object.data).forEach(visit);
	};

	visit(definition.root);
	listSectionRepeaterCollections({
		count: ({ collection }) => collectionItemCounts?.get(collection),
		definition,
	}).forEach(({ count, parentIndex, repeater }) =>
		Array.from({ length: count }, (_, index) => repeater.createValues({ index, parentIndex })).forEach(visit)
	);
};

export const listWebsiteDefinitionLinks = ({
	collectionItemCounts,
	definition,
}: {
	collectionItemCounts?: ReadonlyMap<string, number>;
	definition: SectionDefinition;
}) => {
	const links = new Map<string, { labels: Array<string>; navigation: boolean; path: string }>();
	visitWebsiteDefinitionObjects({
		collectionItemCounts,
		definition,
		onObject: (object) => {
			const href = linkReferenceSchema.safeParse(object.href);

			if (href.success) {
				const path = href.data.$link.replaceAll("/items/", "/");
				links.set(path, {
					labels: [
						...new Set([
							...(links.get(path)?.labels ?? []),
							...textPointers([object.children, object.trigger, object.mobileTrigger]).map((pointer) =>
								pointer.replaceAll("/items/", "/")
							),
						]),
					],
					navigation:
						object.trigger !== undefined || (definition.category === "footer" && object.fill !== "action"),
					path,
				});
			}
		},
	});

	return listSectionContentPointers({ collectionItemCounts, definition, kind: "link" }).map((path) => {
		const link = links.get(path);

		return link ?? { labels: [path.replace(/\/link$/u, "/label")], navigation: false, path };
	});
};
