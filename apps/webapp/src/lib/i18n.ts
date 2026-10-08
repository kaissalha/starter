import type { AppConfig, NamespaceKeys, NestedKeyOf } from "next-intl";
import { getTranslations as getTranslationsServer } from "next-intl/server";

export const getTranslations = async (
	namespace: NamespaceKeys<AppConfig["Messages"], NestedKeyOf<AppConfig["Messages"]>>
) => {
	return await getTranslationsServer(namespace);
};
