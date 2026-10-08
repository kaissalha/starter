import { renderToStaticMarkup } from "react-dom/server";

import { wcagContrast } from "culori";
import { describe, expect, it } from "vitest";

import { brandFontPairings } from "@starter/infinite-brand";

import { projectBrandToWebsiteTheme } from "../src/brand/brand-projection";
import { createGenerationTemplateBrand, websiteGenerationProfiles } from "../src/generation/profiles";
import { SiteRenderer } from "../src/rendering/site-renderer";
import { entityIdFromSeed } from "../src/sections/entity-id";
import { nordicEdgeTemplate } from "../src/templates/nordic-edge";
import nordicEdgeContent from "../src/templates/nordic-edge/content.json";
import { getTemplateBrand } from "../src/templates/template-brand";
import { instantiateTemplate } from "../src/templates/template-definition";
import { themeToCssVariables } from "../src/theme";
import { testBrand } from "./fixtures/brand";

const expectUsableTheme = (theme: ReturnType<typeof projectBrandToWebsiteTheme>) => {
	const { colors } = theme;

	[
		[colors.foreground, colors.canvas],
		[colors.muted, colors.canvas],
		[colors.onSubtle, colors.subtle],
		[colors.onSubtleMuted, colors.subtle],
		[colors.onFeatured, colors.featured],
		[colors.onFeaturedMuted, colors.featured],
		[colors.onAction, colors.action],
		[colors.onAccent, colors.accent],
	].forEach(([foreground, background]) => {
		expect(wcagContrast(foreground ?? "", background ?? "")).toBeGreaterThanOrEqual(4.5);
	});

	[colors.action, colors.accent].forEach((surface) => {
		expect(wcagContrast(surface, colors.canvas)).toBeGreaterThanOrEqual(1.25);
	});

	expect(wcagContrast(colors.border, colors.canvas)).toBeGreaterThanOrEqual(3);
};

describe("Brand projection into Infinite Website", () => {
	it("derives accessible semantic colors and corners without mutating Brand", () => {
		const input = structuredClone(testBrand);
		const theme = projectBrandToWebsiteTheme({ brand: input });

		expect(input).toEqual(testBrand);
		expect(theme.radius).toBe("1rem");

		expectUsableTheme(theme);
	});

	it("projects corner roles and the button style into theme variables", () => {
		const solid = themeToCssVariables({
			locale: "en",
			theme: projectBrandToWebsiteTheme({ brand: { ...testBrand, corners: { style: "soft" } } }),
		});

		const outline = themeToCssVariables({
			locale: "en",
			theme: projectBrandToWebsiteTheme({ brand: { ...testBrand, buttons: { style: "outline" } } }),
		});

		expect(solid["--website-radius"]).toBe("1.5rem");
		expect(solid["--website-radius-control"]).toBe("1.5rem");
		expect(solid["--website-radius-media"]).toBe("1.5rem");
		expect(solid["--website-button-fill"]).toBe("var(--action-primary)");
		expect(solid["--website-button-ring"]).toBe("none");
		expect(outline["--website-button-fill"]).toBe("transparent");
		expect(outline["--website-button-foreground"]).toBe("currentColor");
		expect(outline["--website-button-ring"]).toBe("inset 0 0 0 1.5px currentColor");
	});

	it("resolves English and Arabic variable families through the same theme boundary", () => {
		const theme = projectBrandToWebsiteTheme({ brand: testBrand });
		const english = themeToCssVariables({ locale: "en", theme });
		const arabic = themeToCssVariables({ locale: "ar", theme });

		expect(english["--website-font-brand"]).toContain("Playfair Display Variable");
		expect(english["--website-font-body"]).toContain("Source Serif 4 Variable");
		expect(arabic["--website-font-brand"]).toContain("Noto Naskh Arabic Variable");
		expect(arabic["--website-font-body"]).toContain("Noto Naskh Arabic Variable");
		expect(english["--website-heading-weight"]).toBe(500);
	});

	it("keeps branded action pairs distinct without sacrificing text contrast", () => {
		const theme = projectBrandToWebsiteTheme({
			brand: {
				...testBrand,
				colors: {
					background: "#fbf9f7",
					neutral: "#05060d",
					primary: "#d16702",
					secondary: "#454e5c",
					tertiary: "#e7d5c3",
				},
			},
		});

		expect(wcagContrast(theme.colors.action, theme.colors.canvas)).toBeGreaterThanOrEqual(1.25);
		expect(wcagContrast(theme.colors.onAction, theme.colors.action)).toBeGreaterThanOrEqual(4.5);
	});

	it("keeps controls visible for hostile and every generated theme palette", () => {
		expect(websiteGenerationProfiles).toHaveLength(23);

		const hostileBrand = {
			...testBrand,
			colors: {
				background: "#777777",
				neutral: "#777777",
				primary: "#777777",
				secondary: "#777777",
				tertiary: "#777777",
			},
		};

		expectUsableTheme(projectBrandToWebsiteTheme({ brand: hostileBrand }));

		websiteGenerationProfiles.forEach((profile) => {
			const brand = createGenerationTemplateBrand({ locale: "en", profile });

			expectUsableTheme(projectBrandToWebsiteTheme({ brand }));
		});
	});

	it("makes Brand a required renderer input while leaving the document Brand-free", () => {
		const document = instantiateTemplate({
			content: nordicEdgeContent,
			createId: ({ kind, path }) => entityIdFromSeed({ seed: `brand-renderer:${kind}:${path}` }),
			definition: nordicEdgeTemplate,
			path: "/brand-renderer",
		});

		const html = renderToStaticMarkup(<SiteRenderer brand={testBrand} document={document} locale='ar' />);

		expect(document).not.toHaveProperty("brand");
		expect(document).not.toHaveProperty("theme");
		expect(html).toContain('lang="ar"');
		expect(html).toContain("Noto Naskh Arabic Variable");
		expect(html).toContain("--website-radius:1rem");
		expect(html).toMatch(/text-current[^>]*>الخدمات<\/span>/);
	});

	it("derives pairing weights and tracking from the matched font pairing scale", () => {
		const thin = themeToCssVariables({
			locale: "en",
			theme: projectBrandToWebsiteTheme({ brand: getTemplateBrand({ templateId: "artistic-expression" }) }),
		});

		const modern = themeToCssVariables({
			locale: "en",
			theme: projectBrandToWebsiteTheme({
				brand: {
					...testBrand,
					typography: { ...testBrand.typography, ...brandFontPairings["modern-durable"] },
				},
			}),
		});

		const extralight = themeToCssVariables({
			locale: "en",
			theme: projectBrandToWebsiteTheme({ brand: getTemplateBrand({ templateId: "sparkle-home" }) }),
		});

		expect(thin["--website-type-display-lg-weight"]).toBe(100);
		expect(thin["--website-type-display-lg-tracking"]).toBe("-0.025em");
		expect(extralight["--website-type-body-md-weight"]).toBe(200);
		expect(modern["--website-type-display-lg-weight"]).toBe(800);
		expect(modern["--website-type-heading-lg-family"]).toBe(modern["--website-font-brand"]);
	});

	it("projects a durable light template with near-black tinted text and a visible action", () => {
		const { colors } = projectBrandToWebsiteTheme({ brand: getTemplateBrand({ templateId: "growth-engine" }) });

		expect(wcagContrast(colors.foreground, colors.canvas)).toBeGreaterThanOrEqual(19);
		expect(wcagContrast(colors.muted, colors.canvas)).toBeGreaterThanOrEqual(15.5);
		expect(wcagContrast(colors.onAction, colors.action)).toBeGreaterThanOrEqual(15);
	});
});
