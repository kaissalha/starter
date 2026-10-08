import { createTranslator, useLocale, useMessages } from "next-intl";
import { z } from "zod";

const notificationMessagesSchema = z.compile(
	z.object({
		categories: z.record(z.string(), z.string()),
		types: z.record(z.string(), z.record(z.string(), z.string())),
	})
);

export const useNotificationTranslator = () => {
	const locale = useLocale();
	const { categories, types } = notificationMessagesSchema.parse(useMessages().notifications);

	return {
		category: (category: string) => createTranslator({ locale, messages: categories })(category),
		type: ({ key, type, values }: { key: "setting" | "title"; type: string; values?: { count: number } }) =>
			createTranslator({ locale, messages: types[type] ?? {} })(key, values),
	};
};
