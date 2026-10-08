import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { siteNodeSchema, type CarouselNode } from "../src/document/structure-schema";
import { Carousel } from "../src/primitives/carousel";
import { slideEffectValues } from "../src/primitives/carousel-effect";

const slides = [
	{ content: <div>First</div>, key: "first" },
	{ content: <div>Second</div>, key: "second" },
	{ content: <div>Third</div>, key: "third" },
];

type ArrowOverrides = {
	corners?: "pill" | "round" | "square";
	icon?: "arrow" | "chevron";
	iconSize?: string;
	size?: string;
};

const arrows = (overrides: ArrowOverrides = {}) => [
	{
		align: "start" as const,
		controls: [
			{ kind: "previous" as const, label: "Previous", ...overrides },
			{ kind: "next" as const, label: "Next", ...overrides },
		],
		id: "arrows",
		placement: "after" as const,
	},
];

describe("carousel primitive", () => {
	it("spaces slides with trailing margins instead of a negative track margin", () => {
		const html = renderToStaticMarkup(
			<Carousel controlGroups={[]} gap='1rem' label='Work' slideBasis='50%' slides={slides} />
		);

		expect(html).not.toContain("margin-inline-start:calc");
		expect(html).toContain("margin-inline-end:var(--iw-active-slide-gap, 0px)");
		expect(html).toContain("calc(50% - 0.5 * var(--iw-active-slide-gap, 0px))");
	});

	it("uses the exact slide basis when slides are sized without the gap", () => {
		const html = renderToStaticMarkup(
			<Carousel controlGroups={[]} label='Work' slideBasis='25%' slides={slides} slideSizing='exact' />
		);

		expect(html).toContain("--iw-slide-basis-base:25%");
	});

	it("lays vertical carousels out in a column with block-end spacing", () => {
		const html = renderToStaticMarkup(
			<Carousel controlGroups={[]} label='Column' options={{ axis: "y" }} slideBasis='auto' slides={slides} />
		);

		expect(html).toContain("flex-direction:column");
		expect(html).toContain("margin-block-end:var(--iw-active-slide-gap, 0px)");
		expect(html).not.toContain("margin-inline-end:var(--iw-active-slide-gap");
	});

	it("repeats marquee slides once as inert hidden copies", () => {
		const html = renderToStaticMarkup(
			<Carousel
				controlGroups={[]}
				label='Logos'
				marquee={{ speed: 0.7 }}
				options={{ loop: true }}
				slideBasis='25%'
				slides={slides}
			/>
		);

		expect(html.match(/aria-roledescription="slide"/gu)).toHaveLength(3);
		expect(html.match(/aria-hidden="true"/gu)).toHaveLength(3);
	});

	it("masks the viewport edges on the scroll axis", () => {
		const horizontal = renderToStaticMarkup(
			<Carousel controlGroups={[]} edgeFade={{ size: "10%" }} label='Logos' slideBasis='25%' slides={slides} />
		);

		const vertical = renderToStaticMarkup(
			<Carousel
				controlGroups={[]}
				edgeFade={{}}
				label='Column'
				options={{ axis: "y" }}
				slideBasis='auto'
				slides={slides}
			/>
		);

		expect(horizontal).toContain("mask-image:linear-gradient(to right, transparent 0, #000 10%");
		expect(vertical).toContain("mask-image:linear-gradient(to bottom, transparent 0, #000 8%");
	});

	it("sizes arrows from the control size, corners and icon", () => {
		const round = renderToStaticMarkup(
			<Carousel
				controlGroups={arrows({ iconSize: "5sp", size: "11sp" })}
				label='Work'
				slideBasis='100%'
				slides={slides}
			/>
		);

		const pill = renderToStaticMarkup(
			<Carousel
				controlGroups={arrows({ corners: "pill", size: "10sp" })}
				label='Work'
				slideBasis='100%'
				slides={slides}
			/>
		);

		const square = renderToStaticMarkup(
			<Carousel
				controlGroups={arrows({ corners: "square", icon: "arrow", size: "10sp" })}
				label='Work'
				slideBasis='100%'
				slides={slides}
			/>
		);

		expect(round).toContain("--iw-block-size-base:calc(var(--iw-spacing) * 11)");
		expect(round).toContain("border-radius:9999px");
		expect(pill).toContain("--iw-inline-size-base:calc(calc(var(--iw-spacing) * 10) * 1.75)");
		expect(square).toContain("border-radius:0");
		expect(square).toContain("M19 12H5m6-6-6 6 6 6");
	});

	it("flips arrow icons to the vertical axis", () => {
		const html = renderToStaticMarkup(
			<Carousel
				controlGroups={arrows()}
				label='Column'
				options={{ axis: "y" }}
				slideBasis='auto'
				slides={slides}
			/>
		);

		expect(html).toContain("m18 15-6-6-6 6");
		expect(html).toContain("m6 9 6 6 6-6");
		expect(html).not.toContain("iw-directional-icon");
	});

	it("renders header controls inside the header and a configurable controls gap", () => {
		const html = renderToStaticMarkup(
			<Carousel
				controlGroups={[{ ...arrows()[0], id: "header", placement: "header" }]}
				controlsGap='8sp'
				header={{ content: <h2>Heading</h2>, direction: "row", justify: "between" }}
				label='Work'
				slideBasis='100%'
				slides={slides}
			/>
		);

		expect(html.indexOf("Heading")).toBeLessThan(html.indexOf('aria-label="Previous"'));
		expect(html.indexOf('aria-label="Next"')).toBeLessThan(html.indexOf('aria-roledescription="slide"'));
		expect(html).toContain("--iw-flex-gap-base:calc(var(--iw-spacing) * 8)");
	});

	it("keeps header-placed controls before the viewport when no header exists", () => {
		const html = renderToStaticMarkup(
			<Carousel
				controlGroups={[{ ...arrows()[0], id: "header", placement: "header" }]}
				label='Work'
				slideBasis='100%'
				slides={slides}
			/>
		);

		expect(html.indexOf('aria-label="Previous"')).toBeLessThan(html.indexOf('aria-roledescription="slide"'));
	});

	it("spaces indicators by their own spacing and counters with a bar", () => {
		const html = renderToStaticMarkup(
			<Carousel
				controlGroups={[
					{
						align: "center",
						controls: [
							{
								active: { blockSize: "2sp", inlineSize: "8sp", opacity: 1 },
								inactive: { blockSize: "2sp", inlineSize: "2sp", opacity: 0.3 },
								kind: "indicators",
								label: "Pages",
								spacing: "2sp",
							},
							{ bar: "12sp", kind: "counter", pad: 2 },
						],
						id: "dots",
						placement: "after",
					},
				]}
				label='Work'
				slideBasis='100%'
				slides={slides}
			/>
		);

		expect(html).toContain("gap:calc(var(--iw-spacing) * 2)");
		expect(html).not.toContain("--iw-inline-size-base:2rem");
		expect(html).toContain("h-px");
		expect(html).toContain("calc(var(--iw-spacing) * 12)");
	});

	it("dims and scales inactive slides", () => {
		const html = renderToStaticMarkup(
			<Carousel
				controlGroups={[]}
				inactiveOpacity={0.4}
				inactiveScale={0.9}
				label='Work'
				slideBasis='100%'
				slides={slides}
			/>
		);

		expect(html).toContain("opacity:0.4");
		expect(html).toContain("--iw-slide-inactive-scale:0.9");
	});
});

describe("carousel slide effect", () => {
	const effect = { aspectRatio: { center: 0.9, edge: 1, side: 1.8 }, opacity: { side: 0.4 } };

	it("interpolates aspect ratio and opacity by distance from the centre", () => {
		expect(slideEffectValues({ distance: 0, effect })).toEqual({ aspectRatio: 0.9, opacity: 1 });
		expect(slideEffectValues({ distance: 1, effect })).toEqual({ aspectRatio: 1.8, opacity: 0.4 });
		expect(slideEffectValues({ distance: 1.5, effect }).aspectRatio).toBeCloseTo(1.4);
		expect(slideEffectValues({ distance: 3, effect })).toEqual({ aspectRatio: 1, opacity: 0.4 });
	});

	it("leaves unconfigured channels untouched", () => {
		expect(slideEffectValues({ distance: 0.5, effect: { opacity: { side: 0.5 } } })).toEqual({
			aspectRatio: undefined,
			opacity: 0.75,
		});
	});
});

describe("carousel document contract", () => {
	const carousel = (props: Partial<CarouselNode["props"]>) =>
		siteNodeSchema.safeParse({
			id: crypto.randomUUID(),
			props: {
				controlGroups: [],
				label: { $text: "/label" },
				slideBasis: "100%",
				slides: [],
				...props,
			},
			type: "carousel",
		});

	it("accepts motion, fade, axis and slide effect props", () => {
		expect(
			carousel({
				autoplay: { delay: 5000, pauseOnHover: true },
				edgeFade: { size: "8%" },
				inactiveScale: 0.95,
				marquee: { direction: "backward", speed: 0.5 },
				options: { axis: "y", draggable: false, slidesToScroll: "auto", startIndex: 1, transition: "fade" },
				slideEffect: { aspectRatio: { center: 0.9, edge: 1, side: 1.8 }, opacity: { side: 0.4 } },
				slideSizing: "exact",
			}).success
		).toBe(true);
	});

	it("rejects autoplay delays that would hot-loop", () => {
		expect(carousel({ autoplay: { delay: 100 } }).success).toBe(false);
		expect(carousel({ marquee: { speed: 0 } }).success).toBe(false);
	});
});
