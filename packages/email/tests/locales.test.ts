import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { flattenMessages } from "@starter/utils";

import { getI18n, isSupportedLocale } from "../src/locales";
import arMessages from "../src/locales/messages/ar.json";
import enMessages from "../src/locales/messages/en.json";

describe("email i18n", () => {
	it("falls back to English when locale is unsupported", () => {
		const { t } = getI18n({ locale: "fr" });

		expect(t("otp.title")).toBe("Your verification code");
	});

	it("returns the key when missing", () => {
		const { t } = getI18n({ locale: "en" });

		// @ts-expect-error — invalid key; translator should return the key as fallback
		expect(t("missing.key")).toBe("missing.key");
	});

	it("interpolates variables in messages", () => {
		const { t } = getI18n({ locale: "en" });

		expect(t("welcome.greeting", { firstName: "Sam" })).toContain("Sam");
	});

	it("converts line breaks to HTML", () => {
		const { t } = getI18n({ locale: "en" });

		expect(t("otp.signature")).toContain("<br/>");
	});

	it("renders markup translations", () => {
		const { markup } = getI18n({ locale: "en" });

		const node = markup("test.markup", {
			strong: (chunks) => React.createElement("strong", null, chunks),
		});

		const html = renderToStaticMarkup(React.createElement(React.Fragment, null, node));

		expect(html).toContain("<strong>World</strong>");
	});

	it.each([
		["en", true],
		["ar", true],
		["fr", false],
		[undefined, false],
	])("reports whether %s is supported", (value, expected) => {
		expect(isSupportedLocale(value)).toBe(expected);
	});

	it("keeps Arabic and English message keys in parity", () => {
		expect(Object.keys(flattenMessages({ messages: arMessages })).toSorted()).toEqual(
			Object.keys(flattenMessages({ messages: enMessages })).toSorted()
		);
	});
});
