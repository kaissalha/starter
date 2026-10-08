import type { Iso6391LanguageCode } from "../language-codes";

export type WebsiteLanguageLink = {
	href: string;
	label: string;
	locale: Iso6391LanguageCode;
};

export const WebsiteLanguageSwitcher = ({
	links,
	locale,
}: {
	links: Array<WebsiteLanguageLink>;
	locale: Iso6391LanguageCode;
}) => {
	if (links.length < 2) {
		return null;
	}

	return (
		<nav
			aria-label={new Intl.DisplayNames([locale], { type: "language" }).of(locale)}
			className='flex items-center justify-end gap-4 [border-block-start:1px_solid_var(--border-subtle)] bg-[var(--surface-subtle)] px-[clamp(1.25rem,4vw,4rem)] py-5 font-[family-name:var(--website-font-body)] text-sm text-[var(--foreground-primary)]'
		>
			<div className='flex items-center gap-1'>
				{links.map((link) => (
					<a
						aria-current={link.locale === locale ? "page" : undefined}
						className='inline-flex min-h-11 items-center rounded-[min(var(--website-radius),999px)] px-3.5 text-inherit underline-offset-[0.2em] aria-[current=page]:bg-[var(--action-primary)] aria-[current=page]:text-[var(--action-foreground)] aria-[current=page]:no-underline [&:not([aria-current=page])]:hover:bg-[color-mix(in_srgb,var(--foreground-primary)_8%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--action-primary)]'
						href={link.href}
						hrefLang={link.locale}
						key={link.locale}
					>
						{link.label}
					</a>
				))}
			</div>
		</nav>
	);
};
