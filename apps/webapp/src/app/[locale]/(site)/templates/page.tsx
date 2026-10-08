import type { Metadata } from "next";

import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { generateLocalizedMetadata, generateLocalizedStaticParams } from "@/i18n/routing";

import { Footer } from "../components/sections/footer";
import { Navbar } from "../components/sections/navbar";
import { pilotTemplateIds } from "./pilot-templates";
import { TemplatePreview } from "./template-preview";

export const generateStaticParams = generateLocalizedStaticParams;

export const generateMetadata = async ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => {
	const [{ locale }, t] = await Promise.all([params, getTranslations("templates.index")]);

	return generateLocalizedMetadata({
		description: t("description"),
		locale,
		pathname: "/templates",
		title: t("title"),
	});
};

export default async function TemplatesPage() {
	const t = await getTranslations("templates");

	return (
		<div className='bg-olive-50 text-olive-950'>
			<Navbar />
			<main className='isolate overflow-clip'>
				<section className='mx-auto flex w-full max-w-7xl flex-col gap-12 px-6 py-16 sm:gap-16 lg:px-10'>
					<div className='flex flex-col items-center gap-6 text-center'>
						<h1 className='max-w-5xl font-display text-5xl tracking-tight text-pretty sm:text-7xl'>
							{t("index.heading")}
						</h1>
						<p className='max-w-xl text-lg text-olive-700'>{t("index.intro")}</p>
					</div>
					<ul className='grid gap-8 sm:grid-cols-2 lg:grid-cols-3'>
						{pilotTemplateIds.map((id) => (
							<li key={id}>
								<Link
									className='group flex flex-col gap-4 rounded-2xl focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-olive-700'
									href={`/templates/${id}`}
								>
									<TemplatePreview
										className='transition-[outline-color] group-hover:outline-olive-400'
										size='card'
										templateId={id}
									/>
									<div className='flex items-baseline justify-between gap-4'>
										<h2 className='text-xl font-medium'>{t(`items.${id}.name`)}</h2>
										<span className='text-sm text-olive-600'>{t("index.view")}</span>
									</div>
								</Link>
							</li>
						))}
					</ul>
				</section>
			</main>
			<Footer />
		</div>
	);
}
