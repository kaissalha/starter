import { describe, expect, it } from "vitest";

import {
	defaultContactPageSize,
	getContactListInput,
	parseContactFilters,
} from "@/app/[locale]/dashboard/contacts/contact-list-input";

describe("contact list input", () => {
	it("parses the same validated filter state used by client queries", () => {
		const filters = parseContactFilters('{"contactMethod":["phone"],"missing":["name"]}');

		expect(
			getContactListInput({
				cursor: null,
				filters,
				pageSize: defaultContactPageSize,
				search: "",
				sort: undefined,
			}).filters
		).toEqual({ contactMethod: ["phone"], missing: ["name"] });
	});

	it("maps the spam chip to the onlySpam flag and passes triage categories through", () => {
		const filters = parseContactFilters('{"spam":["only"],"triageCategory":["booking","unknown"]}');
		expect(filters).toEqual({ spam: ["only"], triageCategory: ["booking", "unknown"] });
		expect(
			getContactListInput({
				cursor: null,
				filters,
				pageSize: defaultContactPageSize,
				search: "",
				sort: undefined,
			}).filters
		).toEqual({ onlySpam: true, triageCategory: ["booking", "unknown"] });
	});

	it("drops malformed or unsupported filters at both URL and query boundaries", () => {
		expect(parseContactFilters('{"contactMethod":["sms"]}')).toEqual({});
		expect(parseContactFilters("not-json")).toEqual({});
		expect(
			getContactListInput({
				cursor: null,
				filters: { contactMethod: ["sms"] },
				pageSize: defaultContactPageSize,
				search: "",
				sort: undefined,
			}).filters
		).toEqual({});
	});
});
