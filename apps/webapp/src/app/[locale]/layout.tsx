import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { hasLocale } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";

import { BaseLayout } from "@/components/layout/base-layout";
import { generateLocalizedStaticParams, routing } from "@/i18n/routing";
import { getBaseURL } from "@starter/utils";
import "@starter/ui/globals.css";

export const generateStaticParams = generateLocalizedStaticParams;

export const generateMetadata = async (): Promise<Metadata> => {
	const t = await getTranslations("site.metadata");

	return {
		description: t("description"),
		metadataBase: getBaseURL(),
		title: {
			default: "starter",
			template: "%s | starter",
		},
	};
};

type LocaleLayoutProps = {
	children: React.ReactNode;
	params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
	const [{ locale }, messages, tCommon] = await Promise.all([params, getMessages(), getTranslations("common")]);

	if (!hasLocale(routing.locales, locale)) {
		notFound();
	}

	return (
		<BaseLayout loadingLabel={tCommon("loading")} locale={locale} messages={messages}>
			{children}
		</BaseLayout>
	);
}
