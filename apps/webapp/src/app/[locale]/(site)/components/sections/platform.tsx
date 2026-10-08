import type { ReactNode } from "react";

import Image from "next/image";

import { Search01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getLocale, getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { SilkCard } from "@starter/ui/components/silk-card";
import type { Palette } from "@starter/ui/lib/liquid";

import { LinkPageExample } from "./link-page-example";
import { buildLinkPageExample, linkPageExamples } from "./link-page-examples";
import { SiteFrame } from "./site-frame";

type CardProps = {
	children: ReactNode;
	className?: string;
	description: string;
	features: ReadonlyArray<string>;
	title: string;
};

const people = ["first", "second", "third"] as const;

const domains = [
	{ connected: true, id: "first" },
	{ connected: false, id: "second" },
	{ connected: false, id: "third" },
] as const;

const bakery = linkPageExamples[0];

const CardCopy = ({
	description,
	features,
	title,
}: {
	description: string;
	features: ReadonlyArray<string>;
	title: string;
}) => {
	return (
		<div>
			<h3 className='text-3xl leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-4xl rtl:leading-tight rtl:tracking-normal'>
				{title}
			</h3>
			<p className='mt-3 max-w-md text-base leading-relaxed text-white/80'>{description}</p>
			<ul className='mt-5 flex flex-col gap-2 text-sm text-white/90'>
				{features.map((feature) => (
					<li className='flex items-start gap-2' key={feature}>
						<HugeiconsIcon
							aria-hidden='true'
							className='mt-0.5 size-4 shrink-0 scale-110 text-white/60'
							icon={Tick02Icon}
							strokeWidth={1.75}
						/>
						{feature}
					</li>
				))}
			</ul>
		</div>
	);
};

const SilkPanel = ({
	children,
	className,
	description,
	features,
	palette,
	seed,
	title,
}: CardProps & { palette: Palette; seed: number }) => {
	return (
		<SilkCard className={className} palette={palette} seed={seed} tilt={4}>
			<article className='flex min-h-120 flex-col justify-between gap-10 p-6 sm:p-10'>
				<div className='flex flex-1 items-start'>{children}</div>
				<CardCopy description={description} features={features} title={title} />
			</article>
		</SilkCard>
	);
};

export const Platform = async () => {
	const [locale, t, site, en, ar] = await Promise.all([
		getLocale(),
		getTranslations("site.platform"),
		getTranslations("site.hero.sites.bakery"),
		getTranslations({ locale: "en", namespace: "site.links" }),
		getTranslations({ locale: "ar", namespace: "site.links" }),
	]);

	const linkPage = buildLinkPageExample({ ar, en, example: bakery });

	return (
		<section className='scroll-mt-28 px-6 py-32 sm:py-44 lg:px-10' id='platform'>
			<h2 className='max-w-4xl text-5xl leading-[0.98] font-semibold tracking-[-0.045em] text-balance sm:text-7xl rtl:leading-tight rtl:tracking-normal'>
				{t("title")}
			</h2>
			<p className='mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-olive-700 sm:text-xl'>{t("lead")}</p>
			<div className='mt-20 grid gap-3 lg:grid-cols-3'>
				<SilkPanel
					className='lg:col-span-2'
					description={t("website.description")}
					features={[
						t("website.features.written"),
						t("website.features.mobile"),
						t("website.features.search"),
						t("website.features.domain"),
						t("website.features.analytics"),
					]}
					palette='blue'
					seed={11}
					title={t("website.title")}
				>
					<SiteFrame
						alt={site("alt")}
						className='w-full max-w-2xl'
						cta={site("cta")}
						headline={site("headline")}
						headlineClassName='font-display text-3xl leading-none italic sm:text-5xl rtl:font-semibold rtl:not-italic'
						image='/images/home/site-bakery.webp'
						name={site("name")}
						navigation={site("address")}
						ratio='wide'
					/>
				</SilkPanel>

				<SilkPanel
					description={t("assistant.description")}
					features={[
						t("assistant.features.voice"),
						t("assistant.features.replies"),
						t("assistant.features.knows"),
					]}
					palette='purple'
					seed={41}
					title={t("assistant.title")}
				>
					<div className='flex w-full max-w-sm flex-col gap-3 text-sm leading-relaxed text-olive-950'>
						<p className='ms-10 rounded-2xl rounded-ee-md bg-olive-950 px-4 py-3 text-olive-50 smooth-shadow-xl'>
							{t("assistant.prompt")}
						</p>
						<div className='me-6 overflow-hidden rounded-2xl rounded-es-md bg-white/95 smooth-shadow-xl backdrop-blur-md'>
							<div className='relative aspect-[2/1]'>
								<Image
									alt={site("alt")}
									className='object-cover'
									fill
									sizes='(max-width: 640px) 90vw, 24rem'
									src='/images/home/site-bakery.webp'
								/>
							</div>
							<div className='p-4'>
								<p className='text-xs font-medium text-olive-600'>{t("assistant.draft")}</p>
								<p className='mt-1'>{t("assistant.reply")}</p>
								<p className='mt-3 text-xs text-olive-600'>{t("assistant.channels")}</p>
							</div>
						</div>
					</div>
				</SilkPanel>

				<SilkPanel
					description={t("links.description")}
					features={[t("links.features.actions"), t("links.features.brand"), t("links.features.bio")]}
					palette='orange'
					seed={23}
					title={t("links.title")}
				>
					<div className='relative h-80 w-full overflow-hidden'>
						<LinkPageExample
							brand={linkPage.brand}
							className='absolute inset-x-0 top-0 mx-auto'
							document={linkPage.document}
							locale={locale satisfies Locale}
						/>
					</div>
				</SilkPanel>

				<SilkPanel
					description={t("contacts.description")}
					features={[
						t("contacts.features.captured"),
						t("contacts.features.notes"),
						t("contacts.features.followups"),
					]}
					palette='green'
					seed={31}
					title={t("contacts.title")}
				>
					<ul className='w-full max-w-sm rounded-3xl bg-white/95 p-2 text-olive-950 smooth-shadow-xl backdrop-blur-md'>
						{people.map((id) => (
							<li
								className='flex items-start gap-3 rounded-2xl p-3 not-last:border-b not-last:border-olive-100'
								key={id}
							>
								<span className='flex size-9 shrink-0 items-center justify-center rounded-full bg-olive-200 text-sm font-semibold'>
									{t(`contacts.people.${id}.initial`)}
								</span>
								<span className='min-w-0 flex-1'>
									<span className='flex items-baseline justify-between gap-2'>
										<span className='truncate text-sm font-medium'>
											{t(`contacts.people.${id}.name`)}
										</span>
										<span className='shrink-0 text-xs text-olive-500'>
											{t(`contacts.people.${id}.time`)}
										</span>
									</span>
									<span className='block truncate text-sm text-olive-700'>
										{t(`contacts.people.${id}.detail`)}
									</span>
									<span className='mt-1 inline-block rounded-full bg-olive-100 px-2 py-0.5 text-xs text-olive-600'>
										{t(`contacts.people.${id}.source`)}
									</span>
								</span>
							</li>
						))}
					</ul>
				</SilkPanel>

				<SilkPanel
					description={t("domain.description")}
					features={[t("domain.features.buy"), t("domain.features.dns"), t("domain.features.live")]}
					palette='red'
					seed={53}
					title={t("domain.title")}
				>
					<div className='w-full max-w-sm rounded-3xl bg-white p-2 text-olive-950 smooth-shadow-xl'>
						<div className='flex items-center gap-2 rounded-full bg-olive-100 px-4 py-2.5 text-sm'>
							<HugeiconsIcon
								aria-hidden='true'
								className='size-4 shrink-0 scale-110 text-olive-600'
								icon={Search01Icon}
								strokeWidth={1.75}
							/>
							<span className='font-medium' dir='ltr'>
								{t("domain.query")}
							</span>
						</div>
						<ul className='mt-1'>
							{domains.map((domain) => (
								<li
									className='flex items-center justify-between gap-3 px-3 py-2.5 not-last:border-b not-last:border-olive-100'
									key={domain.id}
								>
									<span className='min-w-0 truncate text-sm font-medium' dir='ltr'>
										{t(`domain.domains.${domain.id}`)}
									</span>
									{domain.connected ? (
										<span className='flex shrink-0 items-center gap-1 rounded-full bg-brand-green/12 px-2.5 py-1 text-xs font-medium text-brand-green-ink'>
											<HugeiconsIcon
												aria-hidden='true'
												className='size-3.5 scale-110'
												icon={Tick02Icon}
												strokeWidth={1.75}
											/>
											{t("domain.connected")}
										</span>
									) : (
										<span className='flex shrink-0 items-center gap-2 text-xs'>
											<span className='text-olive-600'>{t("domain.available")}</span>
											<span className='rounded-full bg-olive-950 px-2.5 py-1 font-medium text-olive-50'>
												{t("domain.action")}
											</span>
										</span>
									)}
								</li>
							))}
						</ul>
					</div>
				</SilkPanel>
			</div>
		</section>
	);
};
