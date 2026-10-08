import { Fragment } from "react";

import type { Metadata } from "next";

import { getMessages, getTranslations } from "next-intl/server";

import { generateLocalizedMetadata, generateLocalizedStaticParams } from "@/i18n/routing";

import { LegalDocument } from "../components/sections/legal-document";

export const generateStaticParams = generateLocalizedStaticParams;

export const generateMetadata = async ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => {
	const [{ locale }, t] = await Promise.all([params, getTranslations("privacy")]);

	return generateLocalizedMetadata({
		description: t("description"),
		locale,
		pathname: "/privacy",
		title: t("title"),
	});
};

const listSectionIds = ["collect", "use", "processors"] as const;

const sectionIds = ["retention", "rights", "cookies", "security", "changes"] as const;

export default async function PrivacyPage() {
	const [t, legal, site, messages] = await Promise.all([
		getTranslations("privacy"),
		getTranslations("legal"),
		getTranslations("site"),
		getMessages(),
	]);

	const privacy = messages.privacy;

	return (
		<LegalDocument
			contact={{ body: t("contact.body"), email: legal("privacyEmail"), heading: t("contact.heading") }}
			title={t("title")}
		>
			<p>{t("intro", { company: legal("company"), service: site("brand") })}</p>

			{listSectionIds.map((id) => (
				<Fragment key={id}>
					<h2 id={id}>{t(`${id}.heading`)}</h2>
					<p>{t(`${id}.intro`)}</p>
					<ul>
						{Object.values(privacy[id].items).map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</Fragment>
			))}
			{sectionIds.map((id) => (
				<Fragment key={id}>
					<h2 id={id}>{t(`${id}.heading`)}</h2>
					<p>{t(`${id}.body`)}</p>
				</Fragment>
			))}
		</LegalDocument>
	);
}
