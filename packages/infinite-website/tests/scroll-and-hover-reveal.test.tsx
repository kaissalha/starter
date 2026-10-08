import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { Box } from "../src/primitives/box";
import { Text } from "../src/primitives/text";

describe("reveal interactions", () => {
	it("marks scroll-in boxes with their animation and timing", () => {
		const html = renderToStaticMarkup(
			<Box reveal={{ animation: "zoom", delayMs: 120, durationMs: 800 }}>child</Box>
		);

		expect(html).toContain("iw-reveal");
		expect(html).toContain('data-animation="zoom"');
		expect(html).toContain("--iw-reveal-delay:120ms");
		expect(html).toContain("--iw-reveal-ms:800ms");
		expect(html).not.toContain("data-reveal=");
	});

	it("renders hover reveal layers with an inert replacement", () => {
		const html = renderToStaticMarkup(
			<Box
				hoverReveal={{
					backdrop: <span>backdrop</span>,
					coverAppearance: { fill: "canvas" },
					replacement: <span>replacement</span>,
				}}
			>
				base
			</Box>
		);

		expect(html).toContain("group/reveal");
		expect(html).toContain("backdrop");
		expect(html).toContain("base");
		expect(html).toMatch(/aria-hidden="true"[^>]*>\s*<span>replacement/u);
		expect(html).toContain("bg-surface-canvas");
	});

	it("splits scroll reveal text into indexed words and keeps whitespace", () => {
		const html = renderToStaticMarkup(<Text content='Reveal one by one' scrollReveal />);

		expect(html.match(/iw-scroll-word/gu)).toHaveLength(4);
		expect(html).toContain("--iw-words:4");
		expect(html).toContain("--iw-word:3");
		expect(html).toContain("Reveal");
	});

	it("leaves plain text untouched without scrollReveal", () => {
		const html = renderToStaticMarkup(<Text content='Reveal one by one' />);

		expect(html).not.toContain("iw-scroll-word");
		expect(html).toContain("Reveal one by one");
	});
});
