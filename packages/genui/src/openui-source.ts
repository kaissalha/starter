import { fromMarkdown } from "mdast-util-from-markdown";

import { OPENUI_CHART_MAGNITUDE_LIMIT } from "./text";

export type OpenUIFenceSegment =
	| { content: string; type: "markdown" }
	| { complete: boolean; content: string; type: "openui" };

const openUIClosingFencePattern = /^ {0,3}`{3,}[\t ]*$/u;

const openUIOpeningFencePattern = /^ {0,3}```openui(?:-lang)?[\t ]*$/u;

const openUINumberLiteralPattern =
	/(?<![\p{L}\p{N}_.])[-+]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:e[-+]?\d+)?(?![\p{L}\p{N}_.])/giu;

const decimalLiteralPattern = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:e([+-]?\d+))?$/iu;

export const parseOpenUIFences = (text: string): Array<OpenUIFenceSegment> => {
	const segments: Array<OpenUIFenceSegment> = [];
	const document = fromMarkdown(text);
	const cursorReference = { value: 0 };

	const pushMarkdown = (content: string) => {
		if (content.trim()) {
			segments.push({ content, type: "markdown" });
		}
	};

	for (const node of document.children) {
		if (node.type !== "code" || (node.lang !== "openui" && node.lang !== "openui-lang") || node.meta) {
			continue;
		}

		const start = node.position?.start;
		const end = node.position?.end.offset;

		if (start?.offset === undefined || end === undefined) {
			continue;
		}

		const blockStart = start.offset - (start.column - 1);
		const openerEnd = text.indexOf("\n", blockStart);
		const opener = text.slice(blockStart, openerEnd === -1 ? end : openerEnd);

		if (!openUIOpeningFencePattern.test(opener)) {
			continue;
		}

		const markdownEnd = text[blockStart - 1] === "\n" ? blockStart - 1 : blockStart;
		pushMarkdown(text.slice(cursorReference.value, markdownEnd));

		const rawBlock = text.slice(blockStart, end);
		const lastLine = rawBlock.split("\n").at(-1) ?? "";
		segments.push({
			complete: openUIClosingFencePattern.test(lastLine),
			content: node.value,
			type: "openui",
		});
		cursorReference.value = text[end] === "\n" ? end + 1 : end;
	}

	pushMarkdown(text.slice(cursorReference.value));

	return segments;
};

const maskOpenUIStringContents = (source: string) => {
	const state = { escaped: false, quoted: false };

	return [...source]
		.map((character) => {
			if (!state.quoted) {
				if (character === '"') {
					state.quoted = true;
				}

				return character;
			}

			if (state.escaped) {
				state.escaped = false;

				return " ";
			}

			if (character === "\\") {
				state.escaped = true;

				return " ";
			}

			if (character === '"') {
				state.quoted = false;

				return character;
			}

			return character === "\n" ? "\n" : " ";
		})
		.join("");
};

const normalizeDecimalLiteral = (literal: string) => {
	const match = decimalLiteralPattern.exec(literal);

	if (!match) {
		return undefined;
	}

	const fraction = match[3] ?? match[4] ?? "";
	const digitsReference = { value: `${match[2] ?? "0"}${fraction}`.replace(/^0+/u, "") };
	const exponentReference = { value: Number(match[5] ?? 0) - fraction.length };

	while (digitsReference.value.endsWith("0")) {
		digitsReference.value = digitsReference.value.slice(0, -1);
		exponentReference.value++;
	}

	if (!digitsReference.value) {
		return "0";
	}

	const sign = match[1] === "-" ? "-" : "";

	return `${sign}${digitsReference.value}e${exponentReference.value}`;
};

export const hasInexactOpenUINumberLiteral = (source: string) =>
	[...maskOpenUIStringContents(source).matchAll(openUINumberLiteralPattern)].some(([literal]) => {
		const value = Number(literal);

		return (
			!Number.isFinite(value) ||
			Math.abs(value) > OPENUI_CHART_MAGNITUDE_LIMIT ||
			normalizeDecimalLiteral(literal) !== normalizeDecimalLiteral(String(value))
		);
	});
