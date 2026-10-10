import type { Document, FileReader } from "@vectorstores/core";
import { CSVReader } from "@vectorstores/readers/csv";
import { DocxReader } from "@vectorstores/readers/docx";
import { HTMLReader } from "@vectorstores/readers/html";
import { PDFReader } from "@vectorstores/readers/pdf";
import { XMLReader } from "@vectorstores/readers/xml";
import { unzipSync } from "fflate";
import { z } from "zod";

import { DOCX_MIME_TYPE, TEXT_FILE_EXTENSIONS, XLSX_MIME_TYPE } from "./file";
import { MAX_INGEST_FILE_SIZE_BYTES, MAX_INGEST_TEXT_LENGTH } from "./upload";

type RagFile = {
	extension: string;
	mimeType: string;
};

const MAX_XLSX_EXPANDED_BYTES = 20 * 1024 * 1024;

const MAX_XLSX_ENTRIES = 200;

const MAX_DOCX_EXPANDED_BYTES = 50 * 1024 * 1024;

const MAX_DOCX_ENTRIES = 500;

const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

const MAX_TABLE_ROWS = 30_000;

const MAX_TABLE_COLUMNS = 200;

const MAX_TABLE_CELLS = 200_000;

const csvRowSchema = z.compile(z.array(z.string()));

const validateXlsxXml = (xml: string, totals: { cells: number; worksheets: number }) => {
	if (/<(?:[\w.-]+:)?workbook\b/.test(xml)) {
		const workbook = { sheets: 0 };

		for (const _ of xml.matchAll(/<(?:[\w.-]+:)?sheet(?=[\s/>])/g)) {
			if (++workbook.sheets > 20) {
				throw new Error("Spreadsheet has too many sheets");
			}
		}
	}

	if (!/<(?:[\w.-]+:)?worksheet\b/.test(xml)) {
		return;
	}

	if (++totals.worksheets > 20) {
		throw new Error("Spreadsheet has too many sheets");
	}

	const worksheet = { rows: 0 };

	for (const tag of xml.matchAll(/<(?:[\w.-]+:)?(row|c)(?=[\s/>])[^>]*>/g)) {
		const reference = /(?:^|\s)r\s*=\s*["']([^"']+)["']/.exec(tag[0])?.[1];

		if (tag[1] === "row") {
			if (++worksheet.rows > MAX_TABLE_ROWS || (reference && Number(reference) > MAX_TABLE_ROWS)) {
				throw new Error("Spreadsheet exceeds the table limit");
			}

			continue;
		}

		const address = /^([A-Z]{1,3})([1-9]\d*)$/.exec(reference ?? "");
		const column = [...(address?.[1] ?? "")].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);

		if (
			++totals.cells > MAX_TABLE_CELLS ||
			!address ||
			Number(address[2]) > MAX_TABLE_ROWS ||
			column > MAX_TABLE_COLUMNS
		) {
			throw new Error("Spreadsheet exceeds the table limit");
		}
	}
};

const unzipXmlEntries = ({
	buffer,
	label,
	maxBytes,
	maxEntries,
}: {
	buffer: Buffer;
	label: string;
	maxBytes: number;
	maxEntries: number;
}) => {
	const archive = { entries: 0, expandedBytes: 0 };

	const xmlFiles = Object.values(
		unzipSync(buffer, {
			filter: ({ name, originalSize }) => {
				if (++archive.entries > maxEntries || (archive.expandedBytes += originalSize) > maxBytes) {
					throw new Error(`${label} exceeds the archive limit`);
				}

				return name.toLowerCase().endsWith(".xml");
			},
		})
	);

	if (xmlFiles.reduce((bytes, content) => bytes + content.byteLength, 0) > maxBytes) {
		throw new Error(`${label} exceeds the archive limit`);
	}

	return xmlFiles;
};

export const readTabularFile = async ({ buffer, extension, mimeType }: RagFile & { buffer: Buffer }) => {
	if (buffer.byteLength > MAX_INGEST_FILE_SIZE_BYTES) {
		throw new Error("File exceeds the ingestion byte limit");
	}

	if (mimeType === XLSX_MIME_TYPE || extension === "xlsx") {
		if (!buffer.subarray(0, 4).equals(ZIP_SIGNATURE)) {
			throw new Error("File content does not match its XLSX type");
		}

		const totals = { cells: 0, worksheets: 0 };

		for (const content of unzipXmlEntries({
			buffer,
			label: "Spreadsheet",
			maxBytes: MAX_XLSX_EXPANDED_BYTES,
			maxEntries: MAX_XLSX_ENTRIES,
		})) {
			validateXlsxXml(new TextDecoder().decode(content), totals);
		}

		const { default: readExcelFile } = await import("read-excel-file/node");
		const sheets = await readExcelFile(buffer);

		if (sheets.length > 20) {
			throw new Error("Spreadsheet has too many sheets");
		}

		return sheets.map(({ data, sheet }) => {
			if (data.length > MAX_TABLE_ROWS || data.some((row) => row.length > MAX_TABLE_COLUMNS)) {
				throw new Error("Spreadsheet exceeds the table limit");
			}

			return {
				rows: data.map((row) =>
					row.map((value) => (value instanceof Date ? value.toISOString() : String(value ?? "")))
				),
				sheet,
			};
		});
	}

	if (mimeType === "text/csv" || extension === "csv") {
		const rows: Array<Array<string>> = [];

		for await (const value of CSVReader.parse(buffer.toString("utf8"), {
			bom: true,
			max_record_size: MAX_INGEST_TEXT_LENGTH,
			skip_empty_lines: true,
		})) {
			const row = csvRowSchema.parse(value);

			if (rows.length >= MAX_TABLE_ROWS || row.length > MAX_TABLE_COLUMNS) {
				throw new Error("CSV exceeds the table limit");
			}

			rows.push(row);
		}

		return [{ rows, sheet: "CSV" }];
	}

	throw new Error("Unsupported table file");
};

type RagFileExtractor = {
	extract: (params: {
		buffer: Buffer;
		content: Uint8Array;
	}) =>
		| Promise<{ pages: Array<{ pageNumber: number; text: string }>; text: string }>
		| { pages: Array<{ pageNumber: number; text: string }>; text: string };
	matches: (file: RagFile) => boolean;
};

const extractWithReader = async ({ content, reader }: { content: Uint8Array; reader: FileReader<Document> }) => {
	const documents = await reader.loadDataAsContent(content);
	const pages: Array<{ pageNumber: number; text: string }> = [];

	const text = documents.reduce((text, document, index) => {
		const next = document.getText();

		if (text.length + next.length + (index ? 2 : 0) > MAX_INGEST_TEXT_LENGTH) {
			throw new Error("Document exceeds the ingestion text limit");
		}

		const pageNumber = z.number().int().positive().safeParse(document.metadata.page_number).data;

		if (pageNumber && next.trim()) {
			pages.push({ pageNumber, text: next });
		}

		return `${text}${index ? "\n\n" : ""}${next}`;
	}, "");

	return { pages, text };
};

const RAG_FILE_EXTRACTORS: Array<RagFileExtractor> = [
	{
		extract: ({ buffer, content }) => {
			if (!buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) {
				throw new Error("File content does not match its PDF type");
			}

			return extractWithReader({ content, reader: new PDFReader() });
		},
		matches: ({ extension, mimeType }) => mimeType === "application/pdf" || extension === "pdf",
	},
	{
		extract: ({ buffer, content }) => {
			if (!buffer.subarray(0, 4).equals(ZIP_SIGNATURE)) {
				throw new Error("File content does not match its DOCX type");
			}

			unzipXmlEntries({
				buffer,
				label: "Document",
				maxBytes: MAX_DOCX_EXPANDED_BYTES,
				maxEntries: MAX_DOCX_ENTRIES,
			});

			return extractWithReader({ content, reader: new DocxReader() });
		},
		matches: ({ extension, mimeType }) => mimeType === DOCX_MIME_TYPE || extension === "docx",
	},
	{
		extract: async ({ buffer }) => {
			const sheets = await readTabularFile({ buffer, extension: "xlsx", mimeType: XLSX_MIME_TYPE });

			return {
				pages: [],
				text: sheets
					.map(({ rows, sheet }) => {
						const [headers = [], ...records] = rows;

						return [
							`Sheet: ${sheet}`,
							`Headers: ${headers.join(", ")}`,
							...records.map(
								(row, index) =>
									`Row ${index + 2}: ${row.map((value, column) => `${headers[column] || `Column ${column + 1}`}: ${value || "N/A"}`).join(", ")}`
							),
						].join("\n");
					})
					.join("\n\n"),
			};
		},
		matches: ({ extension, mimeType }) => mimeType === XLSX_MIME_TYPE || extension === "xlsx",
	},
	{
		extract: async ({ buffer }) => ({
			pages: [],
			text:
				(await readTabularFile({ buffer, extension: "csv", mimeType: "text/csv" }))[0]?.rows
					.map((row) => row.join(", "))
					.join("\n") ?? "",
		}),
		matches: ({ extension, mimeType }) => mimeType === "text/csv" || extension === "csv",
	},
	{
		extract: ({ content }) => extractWithReader({ content, reader: new HTMLReader() }),
		matches: ({ extension, mimeType }) => mimeType === "text/html" || extension === "html" || extension === "htm",
	},
	{
		extract: ({ content }) => extractWithReader({ content, reader: new XMLReader() }),
		matches: ({ extension, mimeType }) =>
			mimeType === "application/xml" || mimeType === "text/xml" || extension === "xml",
	},
	{
		extract: ({ buffer }) => ({ pages: [], text: buffer.toString("utf8") }),
		matches: ({ extension, mimeType }) =>
			mimeType.startsWith("text/") || mimeType === "application/json" || TEXT_FILE_EXTENSIONS.has(extension),
	},
];

export const isSupportedRagFile = (file: RagFile) => RAG_FILE_EXTRACTORS.some((extractor) => extractor.matches(file));

export const extractFileText = async ({ buffer, extension, mimeType }: RagFile & { buffer: Buffer }) => {
	if (buffer.byteLength > MAX_INGEST_FILE_SIZE_BYTES) {
		throw new Error("File exceeds the ingestion byte limit");
	}

	const content = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
	const extractor = RAG_FILE_EXTRACTORS.find((entry) => entry.matches({ extension, mimeType }));

	if (!extractor) {
		throw new Error(`Unsupported file type: ${mimeType || extension || "unknown"}`);
	}

	const extracted = await extractor.extract({ buffer, content });

	if (extracted.text.length > MAX_INGEST_TEXT_LENGTH) {
		throw new Error("Document exceeds the ingestion text limit");
	}

	return extracted;
};
