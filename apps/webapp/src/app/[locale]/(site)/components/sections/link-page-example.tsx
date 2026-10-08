"use client";

import type { BrandFoundationV1 } from "@starter/infinite-brand";
import { LinkPageRenderer, type LinkPageDocument, type LinkPageLocale } from "@starter/infinite-links";
import { cn } from "@starter/ui/lib/utils";

type LinkPageExampleProps = {
	brand: BrandFoundationV1;
	className?: string;
	document: LinkPageDocument;
	locale: LinkPageLocale;
};

export const LinkPageExample = ({ brand, className, document, locale }: LinkPageExampleProps) => {
	return (
		<div
			aria-hidden='true'
			className={cn(
				"pointer-events-none relative h-[120%] w-[15rem] shrink-0 overflow-hidden rounded-[2.25rem] bg-white ring-1 ring-white/20 smooth-shadow-2xl lg:w-[20rem]",
				className
			)}
			inert
		>
			<div className='absolute start-0 top-0 h-[80rem] w-[24.375rem] origin-top-left scale-[0.6154] rtl:origin-top-right lg:scale-[0.8205]'>
				<LinkPageRenderer brand={brand} document={document} locale={locale} preview />
			</div>
		</div>
	);
};
