import { Fragment } from "react";

import type { Metadata } from "next";

import { getTranslations } from "next-intl/server";

import { generateLocalizedMetadata, generateLocalizedStaticParams } from "@/i18n/routing";

import { LegalDocument } from "../components/sections/legal-document";

export const generateStaticParams = generateLocalizedStaticParams;

export const generateMetadata = async ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => {
	const [{ locale }, t] = await Promise.all([params, getTranslations("terms")]);

	return generateLocalizedMetadata({ description: t("description"), locale, pathname: "/terms", title: t("title") });
};

const sectionIds = [
	"acceptance",
	"accounts",
	"content",
	"ai",
	"acceptableUse",
	"termination",
	"disclaimers",
	"liability",
	"changes",
] as const;

export default async function TermsPage() {
	const [t, legal, site] = await Promise.all([
		getTranslations("terms"),
		getTranslations("legal"),
		getTranslations("site"),
	]);

	const values = { company: legal("company"), service: site("brand") };

	return (
		<LegalDocument
			contact={{ body: t("contact.body"), email: legal("legalEmail"), heading: t("contact.heading") }}
			title={t("title")}
		>
			<p>{t("intro", values)}</p>
			{sectionIds.map((id) => (
				<Fragment key={id}>
					<h2 id={id}>{t(`sections.${id}.heading`)}</h2>
					<p>{t(`sections.${id}.body`, values)}</p>
				</Fragment>
			))}
		</LegalDocument>
	);
}
