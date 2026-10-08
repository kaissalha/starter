import { describe, expect, it } from "vitest";

import { getI18n } from "../src/locales";

describe("getI18n", () => {
	it("falls back to English when locale is unsupported", () => {
		const { locale, t } = getI18n({ locale: "fr" });

		expect(locale).toBe("en");
		expect(t("components.footer.page", { pageNumber: 1, totalPages: 2 })).toBe("Page 1 of 2");
	});
});
