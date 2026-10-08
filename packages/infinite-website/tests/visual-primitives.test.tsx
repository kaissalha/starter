import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { Box } from "../src/primitives/box";
import { Disclosure } from "../src/primitives/disclosure";
import { Icon } from "../src/primitives/icon";
import { Media } from "../src/primitives/media";
import { Text } from "../src/primitives/text";

describe("visual primitives", () => {
	it("renders vinyl-style icons filled and keeps stroke icons by default", () => {
		const check = renderToStaticMarkup(<Icon name='check' />);
		const strokeEmail = renderToStaticMarkup(<Icon name='email' />);
		const filledEmail = renderToStaticMarkup(<Icon filled name='email' />);
		const quote = renderToStaticMarkup(<Icon name='quote' />);

		expect(check).toContain("fill-current");
		expect(check).toContain('viewBox="0 0 20 20"');
		expect(strokeEmail).toContain("stroke-current");
		expect(filledEmail).toContain("fill-current");
		expect(filledEmail).not.toBe(strokeEmail);
		expect(quote).toContain('viewBox="0 0 32 32"');
		expect(quote).toContain("rotate(180 16 16)");
	});

	it("mirrors directional arrows in right-to-left layouts", () => {
		expect(renderToStaticMarkup(<Icon name='arrow-up-right' />)).toContain("iw-directional-icon");
		expect(renderToStaticMarkup(<Icon name='arrow-end' />)).toContain("iw-directional-icon");
	});

	it("colors text and icons with the accent color itself", () => {
		expect(renderToStaticMarkup(<Text content='Accent' tone='accent-text' />)).toContain("text-accent-primary");
		expect(renderToStaticMarkup(<Icon name='check' tone='accent-text' />)).toContain("text-accent-primary");
	});

	it("decorates text", () => {
		expect(renderToStaticMarkup(<Text content='Legal' decoration='underline' />)).toContain(
			"text-decoration:underline"
		);
		expect(renderToStaticMarkup(<Text content='Old' decoration='line-through' />)).toContain(
			"text-decoration:line-through"
		);
	});

	it("applies the diagonal slash pattern and per-corner radius", () => {
		const html = renderToStaticMarkup(
			<Box pattern='diagonal-slash' radius={{ endEnd: "theme", startStart: 8 }}>
				Patterned
			</Box>
		);

		expect(html).toContain("iw-pattern");
		expect(html).toContain("border-start-start-radius:8px");
		expect(html).toContain("border-end-end-radius:var(--website-radius)");
		expect(html).not.toContain("border-start-end-radius");
	});

	it("serializes responsive fill opacity into breakpoint variables", () => {
		const html = renderToStaticMarkup(<Box fill='tint' fillOpacity={{ base: 1, compact: 0 }} />);

		expect(html).toContain("iw-fill-opacity");
		expect(html).toContain("--iw-fill-opacity-base:1");
		expect(html).toContain("--iw-fill-opacity-compact:0");
		expect(html).toContain("--iw-fill-color:");
	});

	it("filters media images", () => {
		const asset = { src: "/logo.png", type: "image" } as const;

		expect(renderToStaticMarkup(<Media alt='Logo' asset={asset} filter='grayscale' />)).toContain(
			"filter:grayscale(1)"
		);
		expect(renderToStaticMarkup(<Media alt='Logo' asset={asset} filter='silhouette' />)).toContain(
			"filter:brightness(0)"
		);
	});

	it("omits the trailing divider between disclosure items and scopes padding responsively", () => {
		const items = [
			{ id: "a", panel: "A panel", trigger: "A" },
			{ id: "b", panel: "B panel", trigger: "B" },
		];

		const between = renderToStaticMarkup(<Disclosure divider='between' items={items} />);
		const all = renderToStaticMarkup(<Disclosure items={items} />);

		const responsive = renderToStaticMarkup(
			<Disclosure items={items} panelPadding='1rem' triggerPadding={{ base: "1rem", compact: "2rem" }} />
		);

		expect(between).toContain("last:border-b-0");
		expect(all).not.toContain("last:border-b-0");
		expect(responsive).toContain("--iw-trigger-padding-base:1rem");
		expect(responsive).toContain("--iw-trigger-padding-compact:2rem");
		expect(responsive).toContain("--iw-panel-padding-base:1rem");
	});
});
