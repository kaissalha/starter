import Image from "next/image";

import { getTranslations } from "next-intl/server";

export const HowItWorks = async () => {
	const t = await getTranslations("site.howItWorks");

	return (
		<section className='scroll-mt-28 px-6 py-32 sm:py-44 lg:px-10' id='how-it-works'>
			<div className='grid gap-12 lg:grid-cols-2 lg:gap-20'>
				<div>
					<h2 className='text-5xl leading-[0.98] font-semibold tracking-[-0.045em] text-balance sm:text-7xl rtl:leading-tight rtl:tracking-normal'>
						{t("title")}
					</h2>
					<p className='mt-6 max-w-md text-lg leading-relaxed text-olive-600'>{t("description")}</p>
					<ol className='mt-16'>
						{(["describe", "make", "grow"] as const).map((id) => (
							<li
								className='grid grid-cols-[3.5rem_1fr] gap-4 border-t border-olive-200 py-8 sm:grid-cols-[4.5rem_1fr]'
								key={id}
							>
								<span className='font-mono text-sm text-olive-500'>{t(`steps.${id}.number`)}</span>
								<div>
									<h3 className='text-2xl font-semibold tracking-tight sm:text-3xl rtl:tracking-normal'>
										{t(`steps.${id}.title`)}
									</h3>
									<p className='mt-3 max-w-md text-base leading-relaxed text-olive-600'>
										{t(`steps.${id}.description`)}
									</p>
								</div>
							</li>
						))}
					</ol>
				</div>
				<div className='relative aspect-4/5 overflow-hidden rounded-[28px] bg-olive-200 lg:sticky lg:top-28 lg:order-first lg:self-start'>
					<Image
						alt={t("imageAlt")}
						className='object-cover object-[35%_50%]'
						fill
						sizes='(max-width: 1024px) 100vw, 40rem'
						src='/images/home/open-sign.webp'
					/>
				</div>
			</div>
		</section>
	);
};
