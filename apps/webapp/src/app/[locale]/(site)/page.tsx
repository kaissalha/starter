import type { Metadata } from "next";

import { getTranslations } from "next-intl/server";

import { generateLocalizedMetadata } from "@/i18n/routing";
import { getBaseURL } from "@starter/utils";

import { CTA } from "./components/sections/cta";
import { Facts } from "./components/sections/facts";
import { Faqs } from "./components/sections/faqs";
import { Footer } from "./components/sections/footer";
import { Hero } from "./components/sections/hero";
import { HowItWorks } from "./components/sections/how-it-works";
import { Links } from "./components/sections/links";
import { Navbar } from "./components/sections/navbar";
import { Owners } from "./components/sections/owners";
import { Platform } from "./components/sections/platform";

export const generateMetadata = async ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => {
	const [{ locale }, t] = await Promise.all([params, getTranslations("site.metadata")]);

	return generateLocalizedMetadata({ description: t("description"), locale, pathname: "/", title: t("title") });
};

export default async function Home() {
	const t = await getTranslations("site");
	const { origin: url } = getBaseURL();
	const name = t("brand");

	return (
		<div className='bg-olive-50 font-sans text-olive-950' data-testid='webapp-shell'>
			<script
				dangerouslySetInnerHTML={{
					__html: JSON.stringify({
						"@context": "https://schema.org",
						"@graph": [
							{ "@id": `${url}#organization`, "@type": "Organization", name, url },
							{
								"@id": `${url}#website`,
								"@type": "WebSite",
								description: t("metadata.description"),
								name,
								publisher: { "@id": `${url}#organization` },
								url,
							},
						],
					}).replaceAll("<", String.raw`\u003c`),
				}}
				type='application/ld+json'
			/>
			<Navbar />
			<main className='max-w-dvw overflow-x-clip'>
				<Hero />
				<Owners />
				<Links />
				<Platform />
				<Facts />
				<HowItWorks />
				<Faqs />
				<CTA />
			</main>
			<Footer />
		</div>
	);
}
