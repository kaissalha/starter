import type { AppConfig, NamespaceKeys, NestedKeyOf, useTranslations } from "next-intl";
import type { getTranslations } from "next-intl/server";

export type TranslationFunction<
	TNamespace extends NamespaceKeys<AppConfig["Messages"], NestedKeyOf<AppConfig["Messages"]>>,
> = Awaited<ReturnType<typeof getTranslations<TNamespace>>> | ReturnType<typeof useTranslations<TNamespace>>;
