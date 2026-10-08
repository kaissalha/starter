import { vi } from "vitest";

vi.mock("next-intl", async () => {
	const actual = await import("next-intl");

	return {
		...actual,
		useLocale: () => "en",
		useTranslations: () => (key: string, values?: Record<string, number | string>) =>
			key === "approveCount" ? `${key}:${values?.count}` : key,
	};
});

vi.mock("next-intl/server", () => {
	const getTranslations = async () => {
		const t = (key: string) => key;

		t.rich = (
			key: string,
			{
				link,
				strong,
			}: {
				link?: (chunk: React.ReactNode) => React.ReactNode;
				strong?: (chunk: React.ReactNode) => React.ReactNode;
			}
		) => {
			if (link) {
				return link(key);
			}

			if (strong) {
				return strong(key);
			}

			return key;
		};

		return t;
	};

	const getLocale = () => "en";

	return { getLocale, getTranslations };
});
