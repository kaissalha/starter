import { noAssets, resolveSiteRenderer, type SiteRendererProps } from "./site-renderer-resolution";
import { RenderedSection, SiteRendererRoot, inFlowHeader } from "./site-renderer-shared";

export const SiteRenderer = ({
	assets = noAssets,
	basePath,
	blogPosts,
	brand,
	children,
	contactFormComponent,
	document,
	linkComponent = "a",
	locale = document.defaultLocale,
	pageContent,
	pageSlug,
	preview,
}: SiteRendererProps) => {
	const resolved = resolveSiteRenderer({ basePath, brand, document, locale, pageContent, pageSlug });

	if (!resolved) {
		return null;
	}

	const renderSection = (section: (typeof document.structure.layout.header)[number]) => (
		<RenderedSection
			assets={assets}
			blogPosts={blogPosts}
			contactFormComponent={contactFormComponent}
			context={resolved.context}
			document={document}
			key={section.id}
			linkComponent={linkComponent}
			locale={locale}
			logo={resolved.logo}
			preview={preview}
			section={section.category === "header" ? inFlowHeader(section) : section}
		/>
	);

	const headerSections = document.structure.layout.header.map(renderSection);
	const footerSections = document.structure.layout.footer.map(renderSection);

	return (
		<SiteRendererRoot direction={resolved.direction} locale={resolved.locale} theme={resolved.theme}>
			<a
				className='sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--action-primary)] focus:px-4 focus:py-3 focus:text-[var(--action-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--action-primary)]'
				href='#main'
			>
				{resolved.locale === "ar" ? "انتقل إلى المحتوى الرئيسي" : "Skip to main content"}
			</a>
			{headerSections.length > 0 && <header className='contents'>{headerSections}</header>}
			<main className='contents' id='main'>
				{pageContent ?? resolved.page.sections.map(renderSection)}
			</main>
			{footerSections.length > 0 && <footer className='contents'>{footerSections}</footer>}
			{children}
		</SiteRendererRoot>
	);
};
