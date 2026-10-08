import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { cwd } from "node:process";

const skippedDirectories = new Set([
	".git",
	".next",
	".turbo",
	"build",
	"coverage",
	"dist",
	"node_modules",
]);
const scannedFilePattern = /\.(?:[cm]?[jt]sx?)$/u;
const testFilePattern = /\.(?:test|spec)\.[^.]+$/u;
const absenceMatcherPattern = /\.not\.(?:toContain|toContainText|toHaveTextContent)\(\s*/gu;
const presentMatcherPattern = /(?<!not)\.(?:toContain|toContainText|toHaveTextContent)\(\s*/gu;
export const siblingPrefixLength = 16;

type ContainCall = {
	kind: "absent" | "present";
	start: number;
	end: number;
	quoted: { decoded: string; rawInner: string };
};

type TautologicalAbsenceMatch = {
	start: number;
	end: number;
	needle: string;
};

const isTestPath = (relativePath: string) => testFilePattern.test(relativePath) || relativePath.startsWith("e2e/");

const isInstructionalCopyNeedle = (decoded: string, rawInner: string) => {
	const trimmed = decoded.trim();
	if (!/[A-Za-z]/u.test(trimmed) || !/\s/u.test(trimmed) || /[<>]/u.test(trimmed)) return false;
	if (/^&[a-z]+;/iu.test(trimmed) || /&[a-z]+;/iu.test(trimmed)) return false;
	if (/^(data-|href=|action=|id=|class=|aria-|src=|style=)/u.test(trimmed)) return false;
	if (/^https?:\/\//u.test(trimmed) || /<script|javascript:|onerror=/iu.test(trimmed)) return false;
	if (/\\u[0-9a-f]{4}/iu.test(rawInner) || /\\x[0-9a-f]{2}/iu.test(rawInner)) return false;
	const words = trimmed.split(/\s+/u).filter(Boolean);
	return words.length >= 3 || (words.length === 2 && words.every((word) => /^[A-Z]/u.test(word))) || /[.!?…]$/u.test(trimmed);
};

const longestCommonPrefixLength = (left: string, right: string) => {
	const limit = Math.min(left.length, right.length);
	let index = 0;
	while (index < limit && left[index] === right[index]) index += 1;
	return index;
};

const readQuotedString = (source: string, quoteIndex: number) => {
	const quote = source[quoteIndex];
	if (quote !== "'" && quote !== '"' && quote !== "`") return null;
	let index = quoteIndex + 1;
	let decoded = "";
	while (index < source.length) {
		const character = source[index];
		if (quote === "`" && character === "$" && source[index + 1] === "{") return null;
		if (character === "\\") {
			const escaped = source[index + 1];
			if (escaped === undefined) return null;
			const escapes: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", 0: "\0" };
			if (escaped === "x") {
				const hex = source.slice(index + 2, index + 4);
				if (!/^[0-9a-f]{2}$/iu.test(hex)) return null;
				decoded += String.fromCharCode(Number.parseInt(hex, 16));
				index += 4;
				continue;
			}
			if (escaped === "u") {
				const braced = source[index + 2] === "{";
				const end = braced ? source.indexOf("}", index + 3) : index + 6;
				const hex = source.slice(index + (braced ? 3 : 2), braced ? end : index + 6);
				if (end === -1 || !/^[0-9a-f]+$/iu.test(hex)) return null;
				decoded += braced ? String.fromCodePoint(Number.parseInt(hex, 16)) : String.fromCharCode(Number.parseInt(hex, 16));
				index = braced ? end + 1 : index + 6;
				continue;
			}
			decoded += escapes[escaped] ?? escaped;
			index += 2;
			continue;
		}
		if (character === quote) return { decoded, rawInner: source.slice(quoteIndex + 1, index), end: index + 1 };
		decoded += character;
		index += 1;
	}
	return null;
};

const findContainCalls = (content: string): ContainCall[] => {
	const calls: ContainCall[] = [];
	for (const [kind, pattern] of [["absent", absenceMatcherPattern], ["present", presentMatcherPattern]] as const) {
		pattern.lastIndex = 0;
		let match = pattern.exec(content);
		while (match !== null) {
			const quoted = readQuotedString(content, match.index + match[0].length);
			if (quoted !== null) calls.push({ kind, start: match.index, end: quoted.end, quoted });
			match = pattern.exec(content);
		}
	}
	return calls;
};

const blankAbsenceSpans = (content: string, needle: string, calls: ContainCall[]) => [...calls].reverse().reduce(
	(next, call) => call.kind === "absent" && call.quoted.decoded === needle
		? `${next.slice(0, call.start)}${" ".repeat(call.end - call.start)}${next.slice(call.end)}`
		: next,
	content,
);

const mentionsNeedle = (content: string, needle: { decoded: string; rawInner: string }) => content.includes(needle.decoded) || content.includes(needle.rawInner);

export const findTautologicalAbsenceMatches = ({ relativePath, content, otherContents }: {
	relativePath: string;
	content: string;
	otherContents: string[];
}): TautologicalAbsenceMatch[] => {
	if (!isTestPath(relativePath)) return [];
	const calls = findContainCalls(content);
	const presentNeedles = calls.filter((call) => call.kind === "present").map((call) => call.quoted.decoded);
	const matches: TautologicalAbsenceMatch[] = [];
	const seen = new Set<string>();
	for (const call of calls) {
		if (call.kind !== "absent") continue;
		const { decoded, rawInner } = call.quoted;
		if (!isInstructionalCopyNeedle(decoded, rawInner) || seen.has(decoded)) continue;
		if (presentNeedles.some((present) => longestCommonPrefixLength(present, decoded) >= siblingPrefixLength)) continue;
		if (mentionsNeedle(blankAbsenceSpans(content, decoded, calls), { decoded, rawInner })) continue;
		if (otherContents.some((other) => mentionsNeedle(blankAbsenceSpans(other, decoded, findContainCalls(other)), { decoded, rawInner }))) continue;
		seen.add(decoded);
		matches.push({ start: call.start, end: call.end, needle: decoded });
	}
	return matches;
};

const scannedPaths = (root = cwd()) => {
	const paths: string[] = [];
	const stack = [root];
	while (stack.length > 0) {
		const current = stack.pop();
		if (current === undefined) continue;
		for (const entry of readdirSync(current, { withFileTypes: true })) {
			const absolutePath = path.join(current, entry.name);
			if (entry.isDirectory()) {
				if (!skippedDirectories.has(entry.name)) stack.push(absolutePath);
			} else if (entry.isFile() && scannedFilePattern.test(entry.name)) {
				paths.push(path.relative(root, absolutePath).replaceAll("\\", "/"));
			}
		}
	}
	return paths;
};

let corpus: Map<string, string> | undefined;

export const otherTautologicalAbsenceContents = (filename: string) => {
	corpus ??= new Map(scannedPaths().map((relativePath) => [relativePath, readFileSync(path.join(cwd(), relativePath), "utf8")]));
	const relativePath = path.isAbsolute(filename) ? path.relative(cwd(), filename).replaceAll("\\", "/") : filename;
	return [...corpus].filter(([candidate]) => candidate !== relativePath).map(([, content]) => content);
};
