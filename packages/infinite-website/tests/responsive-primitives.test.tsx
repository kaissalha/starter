import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { pendingTextContent } from "../src/document/content-schema";
import { Action } from "../src/primitives/action";
import { Box } from "../src/primitives/box";
import { Carousel } from "../src/primitives/carousel";
import { Text } from "../src/primitives/text";

describe("responsive primitives", () => {
	it("renders every numeric length as pixels", () => {
		const html = renderToStaticMarkup(
			<Box
				border={{ color: "border", width: 1 }}
				layout={{ padding: { blockStart: 24 }, translate: { inline: -8 } }}
				radius={8}
			>
				Bordered
			</Box>
		);

		expect(html).toContain("border-width:1px");
		expect(html).toContain("border-radius:8px");
		expect(html).toContain("--iw-padding-block-start-base:24px");
		expect(html).toContain("--iw-translate-inline-base:-8px");
	});

	it("renders pending copy as a semantic, content-free skeleton", () => {
		const heading = renderToStaticMarkup(<Text content={pendingTextContent} element='h2' />);
		const body = renderToStaticMarkup(<Text appearance='body-md' content={pendingTextContent} />);
		const label = renderToStaticMarkup(<Text appearance='body-md' content={pendingTextContent} element='span' />);

		expect(heading).toContain('<h2 aria-busy="true"');
		expect(heading).toContain('data-pending=""');
		expect(heading).toContain('<span aria-hidden="true" class="iw-text-skeleton">');
		expect(heading.match(/iw-text-skeleton-line/g)).toHaveLength(1);
		expect(body.match(/iw-text-skeleton-line/g)).toHaveLength(3);
		expect(label.match(/iw-text-skeleton-line/g)).toHaveLength(1);
		expect(`${heading}${body}`).not.toContain("Generating content");
	});

	it("contains long unbroken action labels within their parent", () => {
		const html = renderToStaticMarkup(
			<Action
				fill='transparent'
				font='brand'
				fontSize='2.25rem'
				foreground='primary'
				href={{ href: "mailto:hello@trailboundadventures.com", kind: "email" }}
				radius='none'
			>
				<Text
					content='hello@trailboundadventures.com'
					element='span'
					font='brand'
					fontSize='2.25rem'
					tone='current'
				/>
			</Action>
		);

		expect(html).toContain("font-weight:500");
		expect(html).not.toContain("--iw-text-font-size:");
		expect(html).not.toContain("!important");
		expect(html).toContain("overflow-wrap:anywhere");
	});

	it("keeps the mobile viewport full-bleed without offsetting the track", () => {
		const html = renderToStaticMarkup(
			<Carousel
				controlGroups={[]}
				gap='1rem'
				label='Featured work'
				options={{ align: "start", containScroll: "trim-snaps", loop: false }}
				slideBasis='85%'
				slides={[
					{ content: <div>First</div>, key: "first" },
					{ content: <div>Second</div>, key: "second" },
				]}
			/>
		);

		expect(html).toContain("--iw-inline-size-base:100cqw");
		expect(html).toContain("--iw-margin-inline-start-base:-1.5rem");
		expect(html).toContain("gap:0");
		expect(html).toContain("margin-inline-end:var(--iw-active-slide-gap, 0px)");
		expect(html).not.toContain("padding-inline-start:var(--iw-active-slide-gap");
	});
});
