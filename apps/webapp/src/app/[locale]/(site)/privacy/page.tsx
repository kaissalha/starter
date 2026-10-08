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

const automaticItemIds = ["log", "device", "location"] as const;

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

			<h2>{t("collect.heading")}</h2>
			<p>{t("collect.intro")}</p>
			<ul>
				{Object.values(privacy.collect.items).map((item) => (
					<li key={item}>{item}</li>
				))}
			</ul>
			<p>{t("collect.outro")}</p>

			<h2>{t("collectAutomatically.heading")}</h2>
			<p>{t("collectAutomatically.intro")}</p>
			<ul>
				{automaticItemIds.map((id) => (
					<li key={id}>
						<strong>{t(`collectAutomatically.items.${id}.label`)}</strong>{" "}
						{t(`collectAutomatically.items.${id}.text`)}
					</li>
				))}
			</ul>

			<h2>{t("use.heading")}</h2>
			<p>{t("use.intro")}</p>
			<ul>
				{Object.values(privacy.use.items).map((item) => (
					<li key={item}>{item}</li>
				))}
			</ul>

			<h2>{t("sharing.heading")}</h2>
			<p>{t("sharing.intro")}</p>
			<ul>
				{Object.values(privacy.sharing.items).map((item) => (
					<li key={item}>{item}</li>
				))}
			</ul>

			<h2>{t("visitors.heading")}</h2>
			<p>{t("visitors.body")}</p>

			<h2>{t("processors.heading")}</h2>
			<p>{t("processors.intro")}</p>
			<ul>
				{Object.values(privacy.processors.items).map((item) => (
					<li key={item}>{item}</li>
				))}
			</ul>

			<h2>{t("retention.heading")}</h2>
			<p>{t("retention.body")}</p>

			<h2>{t("rights.heading")}</h2>
			<p>{t("rights.body1")}</p>
			<p>{t("rights.body2")}</p>

			<h2>{t("cookies.heading")}</h2>
			<p>{t("cookies.body")}</p>

			<h2>{t("security.heading")}</h2>
			<p>{t("security.body")}</p>

			<h2>{t("children.heading")}</h2>
			<p>{t("children.body")}</p>

			<h2>{t("international.heading")}</h2>
			<p>{t("international.body")}</p>

			<h2>{t("changes.heading")}</h2>
			<p>{t("changes.body")}</p>
		</LegalDocument>
	);
}
