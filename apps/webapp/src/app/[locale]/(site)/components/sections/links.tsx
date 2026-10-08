import { getLocale, getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { SilkCard } from "@starter/ui/components/silk-card";
import "@starter/infinite-brand/fonts.css";

import { LinkPageExample } from "./link-page-example";
import { buildLinkPageExample, linkPageExamples } from "./link-page-examples";

export const Links = async () => {
	const [locale, t, en, ar] = await Promise.all([
		getLocale(),
		getTranslations("site.links"),
		getTranslations({ locale: "en", namespace: "site.links" }),
		getTranslations({ locale: "ar", namespace: "site.links" }),
	]);

	return (
		<section className='px-3 pb-32 sm:px-6 sm:pb-44' id='links'>
			<div className='px-3 pb-20 lg:px-4'>
				<div className='mt-4 grid gap-6 lg:grid-cols-2 lg:gap-20'>
					<h2 className='text-5xl leading-[0.98] font-semibold tracking-[-0.045em] text-balance sm:text-6xl rtl:leading-tight rtl:tracking-normal'>
						{t("title")}
					</h2>
					<p className='max-w-md self-end text-lg leading-relaxed text-olive-600'>{t("description")}</p>
				</div>
			</div>
			<SilkCard palette='red' seed={13} tilt={2}>
				<div className='relative h-[clamp(32rem,56vw,46rem)] overflow-hidden'>
					<div className='absolute inset-0 flex items-start justify-center gap-4 pt-10 lg:gap-6'>
						{linkPageExamples.map((example) => {
							const { brand, document } = buildLinkPageExample({ ar, en, example });

							return (
								<LinkPageExample
									brand={brand}
									className={example.className}
									document={document}
									key={example.id}
									locale={locale satisfies Locale}
								/>
							);
						})}
					</div>
				</div>
			</SilkCard>
		</section>
	);
};
