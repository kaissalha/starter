import { describe, expect, it } from "vitest";

import { MarkdownDocument, renderToBuffer } from "../src";

describe("MarkdownDocument", () => {
	it("renders headings, lists and inline formatting to a PDF", async () => {
		const buffer = await renderToBuffer(
			<MarkdownDocument
				markdown={
					"# Price list\n\nSpring **cleanup** and [booking](https://example.com).\n\n1. Mowing\n2. Edging\n\n> Quote\n\n---\n\n`code`"
				}
				title='Price list'
			/>
		);

		expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
		expect(buffer.byteLength).toBeGreaterThan(1000);
	});
});
