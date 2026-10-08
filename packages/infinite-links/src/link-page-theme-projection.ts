import type { BrandFoundationV1 } from "@starter/infinite-brand";
import { projectBrandToWebsiteTheme } from "@starter/infinite-website/theme";

import type { LinkPageAppearance } from "./contracts";

export const projectLinkPageTheme = ({
	appearance,
	brand,
}: {
	appearance: LinkPageAppearance;
	brand: BrandFoundationV1;
}) => {
	const projected = projectBrandToWebsiteTheme({ brand });
	const { typography } = appearance;

	const theme = typography
		? {
				...projected,
				typography: {
					...projected.typography,
					body: {
						...projected.typography.body,
						default: { fontId: typography.body.fontId, weight: typography.body.weight },
					},
					heading: {
						...projected.typography.heading,
						default: { fontId: typography.heading.fontId, weight: typography.heading.weight },
					},
				},
			}
		: projected;

	if (!appearance.brandOverride) {
		return theme;
	}

	return {
		...theme,
		colors: {
			...theme.colors,
			action: brand.colors.primary,
			foreground: brand.colors.neutral,
			muted: `color-mix(in srgb, ${brand.colors.neutral} 72%, transparent)`,
			onAction: appearance.buttons.colors.text ?? theme.colors.onAction,
		},
	};
};
