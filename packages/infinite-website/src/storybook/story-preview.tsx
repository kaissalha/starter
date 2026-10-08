import { DirectionProvider } from "@base-ui/react/direction-provider";

import { projectBrandToWebsiteTheme } from "../brand/brand-projection";
import type { SiteNode } from "../document/structure-schema";
import type { AssetMap } from "../rendering/render-node";
import { RenderNode } from "../rendering/render-node";
import { themeToCssVariables, type TextDirection } from "../theme";
import { getTemplateBrand } from "./fixtures/template-brands";

const emptyAssets: AssetMap = {};

const storyBrand = getTemplateBrand({ templateId: "strategic-insight" });

export const StoryPreview = ({
	assets = emptyAssets,
	direction = "ltr",
	node,
}: {
	assets?: AssetMap;
	direction?: TextDirection;
	node: SiteNode;
}) => {
	const locale = direction === "rtl" ? "ar" : "en";
	const theme = projectBrandToWebsiteTheme({ brand: storyBrand });

	return (
		<DirectionProvider direction={direction}>
			<div
				className='website-container'
				dir={direction}
				lang={locale}
				style={themeToCssVariables({ locale, theme })}
			>
				<RenderNode assets={assets} locale={locale} node={node} />
			</div>
		</DirectionProvider>
	);
};
