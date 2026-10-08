import { Document, Page, Text } from "@react-pdf/renderer";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";

import { renderToBuffer } from "../src";

describe("PDF renderer integration", () => {
	it("renders a parseable multi-page artifact with metadata and extractable text", async () => {
		const buffer = await renderToBuffer(
			<Document author='starter' subject='Renderer integration' title='Starter PDF'>
				<Page size='A4'>
					<Text>Starter PDF integration</Text>
					<Text>First page content</Text>
				</Page>
				<Page size='A4'>
					<Text>Second page content</Text>
				</Page>
			</Document>
		);

		expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
		expect(buffer.byteLength).toBeGreaterThan(1000);

		const pdf = await getDocument({
			data: new Uint8Array(buffer),
			verbosity: 0,
		}).promise;

		const metadata = await pdf.getMetadata();

		const text = (
			await Promise.all(
				Array.from({ length: pdf.numPages }, async (_, index) => {
					const page = await pdf.getPage(index + 1);
					const content = await page.getTextContent();

					return content.items
						.flatMap((item) => {
							const value = Object.getOwnPropertyDescriptor(item, "str")?.value;

							return Object.prototype.toString.call(value) === "[object String]" ? [String(value)] : [];
						})
						.join(" ");
				})
			)
		).join(" ");

		expect(pdf.numPages).toBe(2);

		expect(metadata.info).toMatchObject({
			Author: "starter",
			Subject: "Renderer integration",
			Title: "Starter PDF",
		});

		expect(text).toContain("Starter PDF integration");
		expect(text).toContain("First page content");
		expect(text).toContain("Second page content");
	});
});
