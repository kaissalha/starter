"use client";

import { useEffect, type KeyboardEvent, type ReactNode } from "react";

import { useDirection } from "@base-ui/react/direction-provider";
import { cn } from "cn";
import useEmblaCarousel from "embla-carousel-react";

import type { CarouselNode, Layout } from "../document/structure-schema";
import { ControlGroup } from "./carousel-controls";
import { applySlideEffect } from "./carousel-effect";
import { useCarouselPlugins, useCarouselState, useMotionPlayback } from "./carousel-motion";
import { rootStyle, slideStyle, trackStyle, viewportStyle } from "./carousel-style";
import { Flex } from "./flex";
import type { NodeProps } from "./shared";

type CarouselProps = Omit<CarouselNode["props"], "header" | "slides"> & {
	header?: Omit<NodeProps<"flex">, "children"> & { content: ReactNode; layout?: Layout };
	layout?: Layout;
	slides: Array<{ content: ReactNode; key: string }>;
};

const containScrollOption = (value: NonNullable<CarouselProps["options"]>["containScroll"]) => {
	if (value === "trim-snaps") {
		return "trimSnaps";
	}

	if (value === "keep-snaps") {
		return "keepSnaps";
	}

	return value;
};

const arrowKeys = ({ axis, direction }: { axis: "x" | "y"; direction: "ltr" | "rtl" }) => {
	if (axis === "y") {
		return { next: "ArrowDown", previous: "ArrowUp" };
	}

	return direction === "rtl"
		? { next: "ArrowLeft", previous: "ArrowRight" }
		: { next: "ArrowRight", previous: "ArrowLeft" };
};

const renderedSlides = ({
	looping,
	marquee,
	slides,
}: Pick<CarouselProps, "marquee" | "slides"> & { looping: boolean }) => {
	const originals = slides.map((slide) => ({ ...slide, hidden: false }));

	if (!marquee || !looping) {
		return originals;
	}

	return [...originals, ...slides.map((slide) => ({ ...slide, hidden: true, key: `${slide.key}-copy` }))];
};

export const Carousel = (props: CarouselProps) => {
	const { controlGroups, controlsGap, edgeFade, header, label, layout, marquee, options, slideEffect, slides } =
		props;

	const direction = useDirection();
	const axis = options?.axis ?? "x";
	const transition = options?.transition ?? "slide";
	const plugins = useCarouselPlugins({ autoplay: props.autoplay, marquee, transition });

	const [viewportRef, emblaApi] = useEmblaCarousel(
		{
			align: options?.align ?? "center",
			axis,
			containScroll: containScrollOption(options?.containScroll),
			direction,
			duration: options?.duration ?? 24,
			loop: options?.loop ?? false,
			slidesToScroll: options?.slidesToScroll ?? 1,
			startIndex: options?.startIndex ?? 0,
			watchDrag: options?.draggable ?? true,
		},
		plugins
	);

	const state = useCarouselState(emblaApi);
	useMotionPlayback({ api: emblaApi, enabled: plugins.length > 0 });

	useEffect(() => {
		if (!emblaApi || !slideEffect) {
			return;
		}

		const apply = () => applySlideEffect({ api: emblaApi, effect: slideEffect });
		apply();
		emblaApi.on("scroll", apply);
		emblaApi.on("reInit", apply);

		return () => {
			emblaApi.off("scroll", apply);
			emblaApi.off("reInit", apply);
		};
	}, [emblaApi, slideEffect]);

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const keys = arrowKeys({ axis, direction });

		if (event.key === keys.previous) {
			event.preventDefault();
			emblaApi?.scrollPrev();
		}

		if (event.key === keys.next) {
			event.preventDefault();
			emblaApi?.scrollNext();
		}
	};

	const renderGroups = (groups: CarouselProps["controlGroups"]) =>
		groups.map((group) => <ControlGroup api={emblaApi} axis={axis} group={group} key={group.id} state={state} />);

	const headerGroups = controlGroups.filter((group) => group.placement === "header" && header);

	const beforeGroups = controlGroups.filter(
		(group) => group.placement === "before" || (group.placement === "header" && !header)
	);

	const afterGroups = controlGroups.filter((group) => group.placement === "after");
	const items = renderedSlides({ looping: options?.loop === true, marquee, slides });

	return (
		<div
			aria-label={label}
			aria-roledescription='carousel'
			className='iw-layout iw-flex'
			onKeyDown={handleKeyDown}
			role='region'
			style={rootStyle({ controlsGap, layout })}
		>
			{header ? (
				<Flex {...header} layout={header.layout}>
					{header.content}
					{renderGroups(headerGroups)}
				</Flex>
			) : null}
			{renderGroups(beforeGroups)}
			<div
				className='iw-layout'
				ref={viewportRef}
				style={viewportStyle({ axis, edgeFade, viewportLayout: props.viewportLayout })}
			>
				<div
					className={cn(
						"iw-layout iw-carousel-track",
						options?.draggable !== false &&
							"cursor-grab touch-pan-y touch-pinch-zoom active:cursor-grabbing"
					)}
					style={trackStyle({ axis, props })}
				>
					{items.map((slide, index) => (
						<div
							aria-hidden={slide.hidden ? true : undefined}
							aria-label={slide.hidden ? undefined : `${index + 1}/${slides.length}`}
							aria-roledescription={slide.hidden ? undefined : "slide"}
							className='iw-carousel-slide min-w-0 select-none transition-opacity duration-300 ease-out motion-reduce:transition-none'
							inert={slide.hidden ? true : undefined}
							key={slide.key}
							role={slide.hidden ? undefined : "group"}
							style={slideStyle({
								active: state.selectedIndex === index,
								axis,
								flat: transition === "fade",
								props,
							})}
						>
							{slide.content}
						</div>
					))}
				</div>
			</div>
			{renderGroups(afterGroups)}
		</div>
	);
};
