import { renderToStaticMarkup } from "react-dom/server";

import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";

import { SiteRenderer } from "../src/rendering/site-renderer";
import { entityIdFromSeed } from "../src/sections/entity-id";
import { getTemplateBrand } from "../src/storybook/fixtures/template-brands";
import { reliableCoreAssets } from "../src/templates/reliable-core/assets";
import reliableCoreContent from "../src/templates/reliable-core/content.json";
import { reliableCoreTemplate } from "../src/templates/reliable-core/index";
import { instantiateTemplate } from "../src/templates/template-definition";

const document = instantiateTemplate({
	content: reliableCoreContent,
	createId: ({ kind, path }) => entityIdFromSeed({ seed: `brand-logo:${kind}:${path}` }),
	definition: reliableCoreTemplate,
	path: "reliable-core",
});

const brand = getTemplateBrand({ templateId: reliableCoreTemplate.id });

const logo = { scale: 1.5, src: "https://store.public.blob.vercel-storage.com/logo.svg" };

const render = ({ locale, withLogo }: { locale: "ar" | "en"; withLogo: boolean }) => {
	const markup = new Window().document;
	markup.body.innerHTML = renderToStaticMarkup(
		<SiteRenderer
			assets={reliableCoreAssets}
			brand={withLogo ? { ...brand, logo } : brand}
			document={document}
			locale={locale}
		/>
	);

	return markup;
};

describe("brand logo rendering", () => {
	it.each(["en", "ar"] as const)("replaces the header and footer business name with the logo in %s", (locale) => {
		const markup = render({ locale, withLogo: true });
		const siteName = document.content[locale]?.site.name;
		const headerLogo = markup.querySelector(`header [data-website-layout-occupied='brand'] img[src='${logo.src}']`);
		const footerLogo = markup.querySelector(`footer img[src='${logo.src}']`);

		expect(headerLogo?.getAttribute("alt")).toBe(siteName);
		expect(headerLogo?.getAttribute("style")).toContain("--iw-logo-scale:1.5");
		expect(footerLogo?.getAttribute("alt")).toBe(siteName);
		expect([...markup.querySelectorAll("footer h2")].map(({ textContent }) => textContent)).not.toContain(siteName);
	});

	it("falls back to the business name text without a logo", () => {
		const markup = render({ locale: "en", withLogo: false });

		expect(markup.querySelector(`img[src='${logo.src}']`)).toBeNull();
		expect(markup.querySelector("header [data-website-layout-occupied='brand']")?.textContent).toBe(
			"Northshore IT"
		);
		expect(markup.querySelector("footer")?.textContent).toContain("Northshore IT");
	});
});
