import { Globe02Icon, Mail01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getTranslations } from "next-intl/server";

import { SilkCard } from "@starter/ui/components/silk-card";

import { HeroPrompt } from "./hero-prompt";
import { RotatingHeadline } from "./rotating-headline";
import { SiteFrame } from "./site-frame";

const sites = [
	{
		className: "hidden w-[33%] -rotate-6 sm:block rtl:rotate-6",
		headline: "font-display text-3xl leading-none italic rtl:font-semibold rtl:not-italic",
		id: "bakery",
	},
	{
		className: "z-10 w-[90%] sm:w-[42%]",
		headline: "text-3xl leading-[0.9] font-bold tracking-tight uppercase rtl:normal-case",
		id: "barber",
	},
	{
		className: "hidden w-[33%] rotate-6 sm:block rtl:-rotate-6",
		headline: "text-2xl leading-tight font-light tracking-tight",
		id: "ceramics",
	},
] as const;

export const Hero = async () => {
	const t = await getTranslations("site.hero");

	return (
		<section className='pt-24 sm:pt-32' id='hero'>
			<div className='px-6 text-center'>
				<RotatingHeadline
					phrases={[t("phrases.found"), t("phrases.booked"), t("phrases.repeat"), t("phrases.grow")]}
					prefix={t("titlePrefix")}
				/>
				<HeroPrompt
					cta={t("start")}
					label={t("promptLabel")}
					sentences={[t("sentences.bakery"), t("sentences.barber"), t("sentences.florist")]}
				/>
			</div>

			<div className='mx-3 mt-20 sm:mx-6 sm:mt-32'>
				<SilkCard palette='green' seed={7} tilt={2}>
					<div className='relative h-[clamp(26rem,52vw,40rem)] overflow-hidden'>
						<div className='absolute start-4 top-4 flex items-center gap-3 rounded-2xl bg-white/95 p-3 text-olive-950 smooth-shadow-lg backdrop-blur-md sm:start-8 sm:top-8'>
							<span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-olive-950 text-olive-50'>
								<HugeiconsIcon
									aria-hidden='true'
									className='size-4.5 scale-110'
									icon={Globe02Icon}
									strokeWidth={1.75}
								/>
							</span>
							<span className='min-w-0'>
								<span className='block text-xs text-olive-600'>{t("published")}</span>
								<span className='block truncate text-sm font-semibold' dir='ltr'>
									{t("sites.bakery.address")}
								</span>
							</span>
							<span className='flex items-center gap-1 rounded-full bg-brand-green/12 px-2 py-1 text-xs font-medium text-brand-green-ink'>
								<HugeiconsIcon
									aria-hidden='true'
									className='size-3.5 scale-110'
									icon={Tick02Icon}
									strokeWidth={1.75}
								/>
								{t("live")}
							</span>
						</div>
						<div className='absolute end-8 top-8 hidden w-72 rounded-2xl bg-white/95 p-3.5 text-olive-950 smooth-shadow-lg backdrop-blur-md md:block'>
							<p className='flex items-center gap-2 text-xs text-olive-600'>
								<HugeiconsIcon
									aria-hidden='true'
									className='size-3.5 scale-110'
									icon={Mail01Icon}
									strokeWidth={1.75}
								/>
								<span className='font-medium text-olive-950'>{t("enquiry")}</span>
								<span>{t("enquiryFrom")}</span>
							</p>
							<p className='mt-1.5 text-sm leading-snug'>{t("enquiryMessage")}</p>
						</div>
						<div className='absolute inset-x-0 bottom-0 flex translate-y-[30%] items-end justify-center sm:-space-x-[4%] sm:rtl:space-x-reverse'>
							{sites.map((site) => (
								<SiteFrame
									alt={t(`sites.${site.id}.alt`)}
									className={site.className}
									cta={t(`sites.${site.id}.cta`)}
									headline={t(`sites.${site.id}.headline`)}
									headlineClassName={site.headline}
									image={`/images/home/site-${site.id}.webp`}
									key={site.id}
									name={t(`sites.${site.id}.name`)}
									navigation={t(`sites.${site.id}.navigation`)}
								/>
							))}
						</div>
					</div>
				</SilkCard>
			</div>
		</section>
	);
};
