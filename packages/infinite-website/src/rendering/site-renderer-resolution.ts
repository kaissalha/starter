import type { ComponentType, ReactNode } from "react";

import type { BrandFoundationV1 } from "@starter/infinite-brand";

import type { BlogPostSummary } from "../blog/blog-contracts";
import { projectBrandToWebsiteTheme } from "../brand/brand-projection";
import type { ContactFormProps } from "../contact/contact-form-contracts";
import type { SiteDocument } from "../document/site-document-schema";
import type { Iso6391LanguageCode } from "../language-codes";
import type { SiteLinkComponent } from "../primitives/shared";
import { resolveTextDirection } from "../theme";
import type { AssetMap } from "./render-node";
import { createSiteResolutionContext } from "./resolve-persisted-node";

export type SiteRendererProps = {
	assets?: AssetMap;
	basePath?: string;
	blogPosts?: Array<BlogPostSummary>;
	brand: BrandFoundationV1;
	children?: ReactNode;
	contactFormComponent?: ComponentType<ContactFormProps>;
	document: SiteDocument;
	linkComponent?: SiteLinkComponent;
	locale?: Iso6391LanguageCode;
	pageContent?: ReactNode;
	pageSlug?: string;
	preview?: boolean;
};

export const noAssets: AssetMap = {};

export const resolveSiteRenderer = ({
	basePath,
	brand,
	document,
	locale = document.defaultLocale,
	pageContent,
	pageSlug,
}: Pick<SiteRendererProps, "document" | "brand" | "basePath" | "pageSlug" | "locale" | "pageContent">) => {
	const context = createSiteResolutionContext({
		basePath,
		document,
		locale,
		omitPageSections: pageContent !== undefined,
	});

	const page = pageSlug
		? document.structure.pages.find((candidate) => context.pageSlugs.get(candidate.id) === pageSlug)
		: document.structure.pages.find((candidate) => candidate.home);

	if (!page) {
		return null;
	}

	return {
		context,
		direction: resolveTextDirection({ direction: document.direction, locale }),
		locale,
		logo: brand.logo && {
			alt: document.content[locale]?.site.name ?? document.content[document.defaultLocale]?.site.name ?? "",
			scale: brand.logo.scale,
			src: brand.logo.src,
		},
		page,
		theme: projectBrandToWebsiteTheme({ brand }),
	};
};
