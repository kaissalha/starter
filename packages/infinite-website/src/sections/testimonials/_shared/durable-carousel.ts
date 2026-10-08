import type { BoxAppearance, Layout, Length, Responsive, SiteNodeDefinition } from "../../../document/structure-schema";

type CarouselProps = Extract<SiteNodeDefinition, { type: "carousel" }>["props"];

type Control = CarouselProps["controlGroups"][number]["controls"][number];

type Visibility = Responsive<"hidden" | "removed" | "visible">;

const label = ({ name }: { name: string }) => ({ $text: `/accessibility/carousel-testimonials${name}Label` });

type ArrowStyle = Pick<Extract<Control, { kind: "next" | "previous" }>, "corners" | "icon" | "iconSize" | "size">;

export const previousControl = ({
	appearance,
	visibility,
	...style
}: ArrowStyle & {
	appearance?: BoxAppearance;
	visibility?: Visibility;
} = {}): Control => ({ appearance, kind: "previous", label: label({ name: "previous" }), visibility, ...style });

export const nextControl = ({
	appearance,
	visibility,
	...style
}: ArrowStyle & {
	appearance?: BoxAppearance;
	visibility?: Visibility;
} = {}): Control => ({ appearance, kind: "next", label: label({ name: "next" }), visibility, ...style });

export const indicatorsControl = ({
	activeOpacity = 0.3,
	activeWidth = "1.5rem",
	appearance,
	inactiveOpacity = 0.1,
	size = "0.5rem",
	spacing,
	visibility,
}: {
	activeOpacity?: number;
	activeWidth?: Length;
	appearance?: Extract<Control, { kind: "indicators" }>["appearance"];
	inactiveOpacity?: number;
	size?: Length;
	spacing?: Length;
	visibility?: Visibility;
} = {}): Control => ({
	active: { blockSize: size, inlineSize: activeWidth, opacity: activeOpacity },
	appearance,
	inactive: { blockSize: size, inlineSize: size, opacity: inactiveOpacity },
	kind: "indicators",
	label: label({ name: "indicators" }),
	spacing,
	visibility,
});

export const controlGroup = ({
	align = "start",
	appearance,
	controls,
	gap,
	layout,
	placement = "after",
}: {
	align?: "center" | "end" | "start";
	appearance?: BoxAppearance;
	controls: Array<Control>;
	gap?: Length;
	layout?: Layout;
	placement?: "after" | "before" | "header";
}): CarouselProps["controlGroups"][number] => ({ align, appearance, controls, gap, layout, placement });

type CarouselExtras = Partial<
	Pick<
		CarouselProps,
		| "autoplay"
		| "controlsGap"
		| "edgeFade"
		| "header"
		| "inactiveOpacity"
		| "inactiveScale"
		| "marquee"
		| "slideEffect"
		| "slideSizing"
		| "trackLayout"
	>
>;

export const carousel = ({
	controlGroups,
	gap = 0,
	layout,
	options,
	slideBasis,
	viewportLayout,
	...extras
}: CarouselExtras & {
	controlGroups: CarouselProps["controlGroups"];
	gap?: Responsive<Length>;
	layout?: Layout;
	options?: CarouselProps["options"];
	slideBasis: Responsive<Length>;
	viewportLayout?: Layout;
}) =>
	({
		layout,
		props: {
			...extras,
			controlGroups,
			gap,
			label: label({ name: "" }),
			options: { align: "start", containScroll: "trim-snaps", duration: 24, loop: false, ...options },
			slideBasis,
			slides: [],
			viewportLayout: { inlineSize: "full", margin: { inlineEnd: 0, inlineStart: 0 }, ...viewportLayout },
		},
		type: "carousel",
	}) satisfies SiteNodeDefinition;

export const carouselSlidesTarget = ({ path }: { path: string }) => `${path}/props/slides`;
