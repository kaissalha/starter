import { useMemo } from "react";

import type { BrandFoundationV1 } from "@starter/infinite-brand";

import type { Iso6391LanguageCode } from "../language-codes";
import type { AssetMap } from "../rendering/render-node";
import { SiteRenderer } from "../rendering/site-renderer";
import { instantiateTemplate, type TemplateContent, type TemplateDefinition } from "../templates/template-definition";
import { createStoryEntityId } from "./story-entity-id";
import { applyTemplateBrandControls, type TemplateBrandControls } from "./template-story-brand";

export type TemplateStoryPreviewProps = TemplateBrandControls & {
	assets: AssetMap;
	brand: BrandFoundationV1;
	content: TemplateContent;
	definition: TemplateDefinition;
	locale: Iso6391LanguageCode;
};

export const TemplateStoryPreview = ({
	assets,
	backgroundColor,
	bodyWeight,
	brand,
	colorGroup = "custom",
	content,
	cornerStyle,
	definition,
	fontPairing,
	headingWeight,
	locale,
	neutralColor,
	primaryColor,
	secondaryColor,
	tertiaryColor,
}: TemplateStoryPreviewProps) => {
	const document = useMemo(
		() =>
			instantiateTemplate({
				content,
				createId: createStoryEntityId({ scope: definition.id }),
				definition,
				path: "/template",
			}),
		[content, definition]
	);

	const controlledBrand = applyTemplateBrandControls({
		brand,
		controls: {
			backgroundColor,
			bodyWeight,
			colorGroup,
			cornerStyle,
			fontPairing,
			headingWeight,
			neutralColor,
			primaryColor,
			secondaryColor,
			tertiaryColor,
		},
	});

	return <SiteRenderer assets={assets} brand={controlledBrand} document={document} locale={locale} />;
};
