import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArrowLeft02Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { generateLocalizedMetadata, locales } from "@/i18n/routing";
import { Button } from "@starter/ui/components/button";

import { Footer } from "../../components/sections/footer";
import { Navbar } from "../../components/sections/navbar";
import { pilotTemplateIds } from "../pilot-templates";
import { TemplatePreview } from "../template-preview";

type TemplatePageProps = { params: Promise<{ locale: string; slug: string }> };

export const generateStaticParams = () =>
	locales.flatMap((locale) => pilotTemplateIds.map((slug) => ({ locale, slug })));

export const generateMetadata = async ({ params }: TemplatePageProps): Promise<Metadata> => {
	const [{ locale, slug }, t] = await Promise.all([params, getTranslations("templates.items")]);
	const id = pilotTemplateIds.find((entry) => entry === slug);

	if (!id) {
		notFound();
	}

	return generateLocalizedMetadata({
		description: t(`${id}.description`),
		locale,
		pathname: `/templates/${id}`,
		title: t(`${id}.title`),
	});
};

export default async function TemplatePage({ params }: TemplatePageProps) {
	const [{ slug }, t] = await Promise.all([params, getTranslations("templates")]);
	const id = pilotTemplateIds.find((entry) => entry === slug);

	if (!id) {
		notFound();
	}

	return (
		<div className='bg-olive-50 text-olive-950'>
			<Navbar />
			<main className='isolate overflow-clip'>
				<section className='mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-16 sm:gap-12 lg:px-10'>
					<Link
						className='inline-flex items-center gap-2 self-start rounded-sm text-olive-700 hover:text-olive-950 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-olive-700'
						href='/templates'
					>
						<HugeiconsIcon
							aria-hidden='true'
							className='scale-110 rtl:-scale-x-110'
							icon={ArrowLeft02Icon}
							strokeWidth={1.75}
						/>
						{t("detail.backToGallery")}
					</Link>
					<div className='flex flex-col gap-6'>
						<h1 className='max-w-4xl font-display text-4xl tracking-tight text-pretty sm:text-6xl'>
							{t(`items.${id}.title`)}
						</h1>
						<p className='max-w-3xl text-lg leading-relaxed text-olive-700'>{t(`items.${id}.summary`)}</p>
						<Button
							className='self-start'
							nativeButton={false}
							render={<Link href='/dashboard/website' />}
							size='xl'
						>
							{t("detail.cta")}
							<HugeiconsIcon
								aria-hidden='true'
								className='scale-110 rtl:-scale-x-110'
								data-icon='inline-end'
								icon={ArrowRight02Icon}
								strokeWidth={1.75}
							/>
						</Button>
					</div>
					<TemplatePreview size='detail' templateId={id} />
				</section>
			</main>
			<Footer />
		</div>
	);
}
