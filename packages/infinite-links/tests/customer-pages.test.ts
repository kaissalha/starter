import { describe, expect, it } from "vitest";

import { linkPageDocumentSchema } from "../src/contracts";
import customerPages from "../src/customer-pages.json";
import { createDefaultLinkPageDocument } from "../src/link-page-document";
import { linkPageThemes } from "../src/themes";

describe("customer example pages", () => {
	it("provides a valid example page for every customer theme but Antalya", () => {
		const base = createDefaultLinkPageDocument({ name: "Example" });
		const ids = new Set(linkPageThemes.map((theme) => theme.id));
		const pages = Object.entries(customerPages);
		expect(pages.length).toBe(ids.size - 1);

		const failures = pages.flatMap(([id, page]) => {
			expect(ids.has(id)).toBe(true);

			const result = linkPageDocumentSchema.safeParse({
				...base,
				...page,
				profile: { ...base.profile, ...page.profile },
			});

			return result.error
				? [`${id}: ${result.error.issues[0]?.path.join(".")} ${result.error.issues[0]?.message}`]
				: [];
		});

		expect(failures).toEqual([]);
	});
});
