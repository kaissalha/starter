import { connection } from "next/server";

import { getTranslations } from "@/lib/i18n";
import { getTimezone } from "@/utils/get-timezone";

const hourFormatters = new Map<string, Intl.DateTimeFormat>();

export const getGreetingFromHour = async (hour: number) => {
	const t = await getTranslations("dashboard.home.greeting");

	if (hour >= 5 && hour < 12) {
		return t("morning");
	} else if (hour >= 12 && hour < 17) {
		return t("afternoon");
	}

	return t("evening");
};

export const getGreetingFromTimezone = async () => {
	await connection();

	const timezone = await getTimezone();

	try {
		const formatterReference = { value: hourFormatters.get(timezone) };

		if (!formatterReference.value) {
			formatterReference.value = new Intl.DateTimeFormat("en-US", {
				hour: "numeric",
				hour12: false,
				timeZone: timezone,
			});

			hourFormatters.set(timezone, formatterReference.value);
		}

		const hour = Number.parseInt(formatterReference.value.format(new Date()), 10);

		return await getGreetingFromHour(hour);
	} catch {
		return await getGreetingFromHour(new Date().getHours());
	}
};
