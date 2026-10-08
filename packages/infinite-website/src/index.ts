export { withBlogNavigation } from "./blog/blog-navigation";

export {
	blogBodySchema,
	blogPostDocumentSchema,
	blogPublishDocumentSchema,
	blogLocaleContentSchema,
	blogUrlSchema,
	createEmptyBlogPostDocument,
	getBlogBodyText,
	getBlogLocaleContent,
	setBlogLocaleContent,
	listBlogLocales,
	getBlogTranslationSource,
	type BlogPostDocument,
	type BlogPostLocaleContent,
	type BlogBody,
	type BlogNode,
	type BlogPostSummary,
} from "./blog/blog-contracts";

export { BlogArticle, BlogPostGrid } from "./blog/blog-renderer";

export { SiteRenderer } from "./rendering/site-renderer";

export type { SiteRendererProps } from "./rendering/site-renderer-resolution";

export { WebsiteFallbackPage, websiteFallbackActionClassName } from "./rendering/fallback-page";

export { WebsiteLanguageSwitcher, type WebsiteLanguageLink } from "./rendering/website-language-switcher";

export { type AssetMap } from "./rendering/render-node";

export {
	siteBehaviorProgramSchema,
	siteExpressionIrSchema,
	type SiteBehaviorProgramV1,
	type SiteExpressionIrV1,
} from "./behavior/contracts";

export { type ResolvedAsset, type SiteLinkComponent, type SiteLinkProps } from "./primitives/shared";

export { parseSiteDocument, validateSiteDocument, websiteBrandGuidelinesSlug } from "./document/document-validation";

export { siteDocumentJsonSchema, siteDocumentSchema, type SiteDocument } from "./document/site-document-schema";

export {
	resolveLocalizedContent,
	resolveLocalizedPageSlug,
	resolveSectionContentReference,
	jsonObjectSchema,
	linkValueSchema,
	pageSlugSchema,
	type AssetReference,
	type ContentReference,
	type LinkReference,
	type LinkValue,
	type JsonValue,
	type SettingReference,
	type LocalizedContent,
	type TextReference,
} from "./document/content-schema";

export { listSiteDocumentAssetIds } from "./document/section-content-references";

export { createWebsiteSectionPreviewDocument } from "./document/section-preview";

export { entityIdFromSeed } from "./sections/entity-id";

export {
	coreNodeTypes,
	sectionCategories,
	siteNodeSchema,
	siteSectionSchema,
	type Alignment,
	type CoreNodeType,
	type CrossAlignment,
	type Edges,
	type Fill,
	type FocalPoint,
	type Foreground,
	type Layout,
	type Length,
	type MediaOverlay,
	type PersistedSiteNode,
	type Responsive,
	type ResolvedLink,
	type SectionCategory,
	type SiteNodeDefinition,
	type SiteSection,
	type SiteNode,
	type VideoPlayback,
} from "./document/structure-schema";

export {
	defineSection,
	instantiateSection,
	type CreateEntityId,
	type EntityIdKind,
	type LocalizedSectionContent,
	type SectionDefinition,
	type SectionRepeater,
} from "./sections/section-definition";

export {
	defineTemplate,
	instantiateTemplate,
	type TemplateContent,
	type TemplateDefinition,
} from "./templates/template-definition";

export { iso6391LanguageCodes, type Iso6391LanguageCode } from "./language-codes";

export { projectBrandToWebsiteTheme, type WebsiteTheme } from "./brand/brand-projection";

export { resolveTextDirection, themeToCssVariables } from "./theme";

export { ContactForm } from "./contact/contact-form";

export type { ContactFormProps, ContactFormSubmission } from "./contact/contact-form-contracts";

export { websiteSettingsSchema, defaultWebsiteSettings, type WebsiteSettings } from "./document/website-settings";

export { getBlogLabels, blogLabelsSchema } from "./blog/blog-labels";
