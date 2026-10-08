import { strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";

const pdfRead = vi.hoisted(() => vi.fn());

vi.mock("@vectorstores/readers/pdf", () => ({
	PDFReader: class {
		loadDataAsContent = pdfRead;
	},
}));

import { extractFileText, isSupportedRagFile, readTabularFile } from "../src/extraction";
import { MAX_INGEST_FILE_SIZE_BYTES, MAX_INGEST_TEXT_LENGTH } from "../src/upload";

const supportedRagFiles = [
	["PDF MIME type", "bin", "application/pdf"],
	["PDF extension", "pdf", "application/octet-stream"],
	["DOCX MIME type", "bin", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
	["DOCX extension", "docx", "application/octet-stream"],
	["XLSX MIME type", "bin", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
	["XLSX extension", "xlsx", "application/octet-stream"],
	["CSV MIME type", "bin", "text/csv"],
	["CSV extension", "csv", "application/octet-stream"],
	["HTML MIME type", "bin", "text/html"],
	["HTML extension", "html", "application/octet-stream"],
	["HTM extension", "htm", "application/octet-stream"],
	["application XML MIME type", "bin", "application/xml"],
	["text XML MIME type", "bin", "text/xml"],
	["XML extension", "xml", "application/octet-stream"],
	["generic text MIME type", "bin", "text/x-custom"],
	["JSON MIME type", "bin", "application/json"],
	...["json", "log", "md", "mdx", "txt", "yaml", "yml"].map(
		(extension) => [`${extension.toUpperCase()} extension`, extension, "application/octet-stream"] as const
	),
] as const;

const unsupportedRagFiles = [
	["image", "png", "image/png"],
	["binary", "bin", "application/octet-stream"],
	["legacy XLS", "xls", "application/vnd.ms-excel"],
	["unknown", "", ""],
] as const;

const sampleXlsx = zipSync({
	"_rels/.rels": strToU8(
		'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
	),
	"[Content_Types].xml": strToU8(
		'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'
	),
	"xl/_rels/workbook.xml.rels": strToU8(
		'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>'
	),
	"xl/workbook.xml": strToU8(
		'<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sales" sheetId="1" r:id="rId1"/><sheet name="Arabic" sheetId="2" r:id="rId2"/></sheets></workbook>'
	),
	"xl/worksheets/sheet1.xml": strToU8(
		'<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Item</t></is></c><c r="B1" t="inlineStr"><is><t>Amount</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Apples</t></is></c><c r="B2"><v>42</v></c></row></sheetData></worksheet>'
	),
	"xl/worksheets/sheet2.xml": strToU8(
		'<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>العنصر</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>تفاح</t></is></c></row></sheetData></worksheet>'
	),
});

describe("document extraction", () => {
	it("reads XLSX sheets and preserves sheet and row context", async () => {
		const buffer = Buffer.from(sampleXlsx);
		await expect(
			readTabularFile({ buffer, extension: "xlsx", mimeType: "application/octet-stream" })
		).resolves.toEqual([
			{
				rows: [
					["Item", "Amount"],
					["Apples", "42"],
				],
				sheet: "Sales",
			},
			{ rows: [["العنصر"], ["تفاح"]], sheet: "Arabic" },
		]);
		await expect(
			extractFileText({ buffer, extension: "xlsx", mimeType: "application/octet-stream" })
		).resolves.toMatchObject({
			pages: [],
			text: expect.stringContaining("Sheet: Sales\nHeaders: Item, Amount\nRow 2: Item: Apples, Amount: 42"),
		});
	});

	it("rejects high-expansion XLSX archives before parsing", async () => {
		const buffer = Buffer.from(zipSync({ "xl/huge.xml": new Uint8Array(21 * 1024 * 1024) }));
		await expect(
			readTabularFile({ buffer, extension: "xlsx", mimeType: "application/octet-stream" })
		).rejects.toThrow("archive limit");
	});

	it.each([
		["distant row", "A30001", 30_001],
		["distant column", "GS1", 1],
	])("rejects an XLSX with a %s before parsing", async (_description, address, row) => {
		const buffer = Buffer.from(
			zipSync({
				...unzipSync(sampleXlsx),
				"xl/worksheets/sheet1.xml": strToU8(
					`<worksheet><sheetData><row r="${row}"><c r="${address}"><v>1</v></c></row></sheetData></worksheet>`
				),
			})
		);

		await expect(
			readTabularFile({ buffer, extension: "xlsx", mimeType: "application/octet-stream" })
		).rejects.toThrow("table limit");
	});

	it("rejects an XLSX workbook with too many sheets before parsing", async () => {
		const buffer = Buffer.from(
			zipSync({
				...unzipSync(sampleXlsx),
				"xl/workbook.xml": strToU8(
					`<workbook><sheets>${Array.from({ length: 21 }, (_, index) => `<sheet name="Sheet${index}" sheetId="${index + 1}" r:id="rId1"/>`).join("")}</sheets></workbook>`
				),
			})
		);

		await expect(
			readTabularFile({ buffer, extension: "xlsx", mimeType: "application/octet-stream" })
		).rejects.toThrow("too many sheets");
	});

	it("parses quoted CSV cells and embedded newlines", async () => {
		const buffer = Buffer.from('\ufeffname,amount\n"Alice, A",42\n"Two\nLines",7');
		await expect(readTabularFile({ buffer, extension: "csv", mimeType: "text/csv" })).resolves.toEqual([
			{
				rows: [
					["name", "amount"],
					["Alice, A", "42"],
					["Two\nLines", "7"],
				],
				sheet: "CSV",
			},
		]);
	});
	it("preserves PDF page numbers while retaining combined text for classification", async () => {
		pdfRead.mockResolvedValueOnce([
			{ getText: () => "First page", metadata: { page_number: 1 } },
			{ getText: () => " ", metadata: { page_number: 2 } },
			{ getText: () => "Third page", metadata: { page_number: 3 } },
		]);
		await expect(
			extractFileText({ buffer: Buffer.from("%PDF-1.7"), extension: "pdf", mimeType: "application/pdf" })
		).resolves.toEqual({
			pages: [
				{ pageNumber: 1, text: "First page" },
				{ pageNumber: 3, text: "Third page" },
			],
			text: "First page\n\n \n\nThird page",
		});
	});

	it.each([
		["PDF", "pdf", "application/pdf", Buffer.from("plain text")],
		[
			"DOCX",
			"docx",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			Buffer.from("plain"),
		],
		["XLSX", "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", Buffer.from("plain")],
	])("rejects %s content without its file signature", async (type, extension, mimeType, buffer) => {
		await expect(extractFileText({ buffer, extension, mimeType })).rejects.toThrow(
			`File content does not match its ${type} type`
		);
		expect(pdfRead).not.toHaveBeenCalled();
	});

	it.each([
		[
			"too many entries",
			Object.fromEntries(Array.from({ length: 501 }, (_, index) => [`word/part${index}.xml`, strToU8("<w/>")])),
		],
		["high expansion", { "word/document.xml": new Uint8Array(51 * 1024 * 1024) }],
	])("rejects DOCX archives with %s before parsing", async (_description, entries) => {
		await expect(
			extractFileText({
				buffer: Buffer.from(zipSync(entries)),
				extension: "docx",
				mimeType: "application/octet-stream",
			})
		).rejects.toThrow("Document exceeds the archive limit");
	});

	it("rejects oversized input before parsing", async () => {
		await expect(
			extractFileText({
				buffer: Buffer.alloc(MAX_INGEST_FILE_SIZE_BYTES + 1),
				extension: "pdf",
				mimeType: "application/pdf",
			})
		).rejects.toThrow("File exceeds the ingestion byte limit");
	});

	it("accepts text at the limit and rejects larger plain text and reader output", async () => {
		const text = "a".repeat(MAX_INGEST_TEXT_LENGTH);
		await expect(
			extractFileText({ buffer: Buffer.from(text), extension: "txt", mimeType: "text/plain" })
		).resolves.toEqual({ pages: [], text });
		await expect(
			extractFileText({ buffer: Buffer.from(`${text}a`), extension: "txt", mimeType: "text/plain" })
		).rejects.toThrow("Document exceeds the ingestion text limit");
		await expect(
			extractFileText({ buffer: Buffer.from(`<p>${text}a</p>`), extension: "html", mimeType: "text/html" })
		).rejects.toThrow("Document exceeds the ingestion text limit");
	});

	it.each(supportedRagFiles)("supports files by %s", (_description, extension, mimeType) => {
		expect(isSupportedRagFile({ extension, mimeType })).toBe(true);
	});

	it.each(unsupportedRagFiles)("rejects unsupported %s files", (_description, extension, mimeType) => {
		expect(isSupportedRagFile({ extension, mimeType })).toBe(false);
	});

	it.each([
		{
			expected: "name, amount\nAlice, 42\nليلى, 7",
			extension: "csv",
			mimeType: "text/csv",
			name: "CSV",
			source: "name,amount\nAlice,42\nليلى,7",
		},
		{
			expected: "Quarterly Report Revenue grew to $42 and stayed ready.",
			extension: "html",
			mimeType: "text/html",
			name: "HTML",
			source: "<article><h1>Quarterly Report</h1><p>Revenue grew to $42 and stayed ready.</p></article>",
		},
		{
			expected:
				'<report><title>Quarterly Report</title><amount currency="USD">42</amount><status>جاهز</status></report>',
			extension: "xml",
			mimeType: "application/xml",
			name: "XML",
			source: '<?xml version="1.0"?><report><title>Quarterly Report</title><amount currency="USD">42</amount><status>جاهز</status></report>',
		},
		{
			expected: '{\n  "title": "Quarterly Report",\n  "amount": 42,\n  "status": "ready"\n}',
			extension: "json",
			mimeType: "application/json",
			name: "JSON",
			source: '{\n  "title": "Quarterly Report",\n  "amount": 42,\n  "status": "ready"\n}',
		},
		{
			expected: "# Quarterly Report\n\nRevenue is **42** and the status is جاهز.",
			extension: "md",
			mimeType: "application/octet-stream",
			name: "Markdown",
			source: "# Quarterly Report\n\nRevenue is **42** and the status is جاهز.",
		},
		{
			expected: "Quarterly Report\nRevenue is 42 and the status is جاهز.",
			extension: "bin",
			mimeType: "text/plain",
			name: "plain text",
			source: "Quarterly Report\nRevenue is 42 and the status is جاهز.",
		},
	])("preserves $name content", async ({ expected, extension, mimeType, source }) => {
		await expect(extractFileText({ buffer: Buffer.from(source), extension, mimeType })).resolves.toEqual({
			pages: [],
			text: expected,
		});
	});
});
