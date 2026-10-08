import type { ReactNode } from "react";

import { isLinkPageHref } from "./contracts";

const headingClassNames = {
	1: "text-[2.2em] leading-[1.1]",
	2: "text-[1.6em] leading-[1.1]",
	3: "text-[1.3em] leading-[1.1]",
} as const;

const inlinePattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/u;

const renderInline = (text: string): ReactNode =>
	text.split(inlinePattern).map((part, index) => {
		if (part.startsWith("**") && part.endsWith("**")) {
			return <strong key={index}>{part.slice(2, -2)}</strong>;
		}

		if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
			return <em key={index}>{part.slice(1, -1)}</em>;
		}

		const link = /^\[([^\]]+)\]\(([^)]+)\)$/u.exec(part);

		if (link) {
			const href = link[2]?.trim() ?? "";

			if (!isLinkPageHref(href)) {
				return link[1];
			}

			return (
				<a className='underline' href={href} key={index} rel='noopener noreferrer' target='_blank'>
					{link[1]}
				</a>
			);
		}

		return part;
	});

type RichBlock =
	| { kind: "heading"; level: 1 | 2 | 3; text: string }
	| { kind: "list" | "paragraph"; lines: Array<string> };

const headingLevels = new Map<number, 1 | 2 | 3>([
	[1, 1],
	[2, 2],
	[3, 3],
]);

const parseRichText = (text: string) => {
	const blocks: Array<RichBlock> = [];

	for (const line of text.split("\n")) {
		const heading = /^(#{1,3})\s+(.*)$/u.exec(line);
		const last = blocks.at(-1);

		if (heading) {
			blocks.push({
				kind: "heading",
				level: headingLevels.get(heading[1].length) ?? 3,
				text: heading[2],
			});
		} else if (line.startsWith("- ")) {
			if (last?.kind === "list") {
				last.lines.push(line.slice(2));
			} else {
				blocks.push({ kind: "list", lines: [line.slice(2)] });
			}
		} else if (line.trim() === "") {
			blocks.push({ kind: "paragraph", lines: [] });
		} else if (last?.kind === "paragraph") {
			last.lines.push(line);
		} else {
			blocks.push({ kind: "paragraph", lines: [line] });
		}
	}

	return blocks;
};

export const LinkPageRichText = ({ className, text }: { className: string; text: string }) => (
	<div className={`flex flex-col gap-[1em] ${className}`}>
		{parseRichText(text).map((block, index) => {
			if (block.kind === "heading") {
				const Tag = `h${block.level}` as const;

				return (
					<Tag className={headingClassNames[block.level]} key={index}>
						{renderInline(block.text)}
					</Tag>
				);
			}

			if (block.kind === "list") {
				return (
					<ul className='list-disc ps-[1.4em] text-start' key={index}>
						{block.lines.map((line, lineIndex) => (
							<li key={lineIndex}>{renderInline(line)}</li>
						))}
					</ul>
				);
			}

			return block.lines.length === 0 ? null : (
				<p key={index}>
					{block.lines.map((line, lineIndex) => (
						<span key={lineIndex}>
							{lineIndex > 0 && <br />}
							{renderInline(line)}
						</span>
					))}
				</p>
			);
		})}
	</div>
);
