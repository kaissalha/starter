import { expect, it } from "vitest";

import { getDirection } from "../src/locale";

it("detects the language script and honors explicit script subtags", () => {
	for (const locale of ["ar", "he", "fa", "ur", "dv", "ps", "sd", "yi", "ug", "pa-Arab", "ku-Arab"]) {
		expect(getDirection(locale)).toBe("rtl");
	}

	for (const locale of ["en", "fr", "hi", "ku", "az", "pa-Guru", "ar-Latn", "invalid_locale"]) {
		expect(getDirection(locale)).toBe("ltr");
	}
});
