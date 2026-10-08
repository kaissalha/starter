import { describe, expect, it } from "vitest";

import { localeSchema } from "../src/localization";

describe("Brand localization", () => {
	it("canonicalizes supported BCP 47 locale tags", () => {
		expect(localeSchema.parse("EN-ca")).toBe("en-CA");
		expect(localeSchema.parse("ar")).toBe("ar");
		expect(localeSchema.parse("EN-u-ca-gregory")).toBe("en-u-ca-gregory");
		expect(localeSchema.safeParse("en_US").success).toBe(false);
	});
});
