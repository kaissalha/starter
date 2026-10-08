import { useEffect, useEffectEvent, useMemo, useState, useSyncExternalStore } from "react";

import type { EmblaCarouselType, EmblaPluginType } from "embla-carousel";
import AutoScroll from "embla-carousel-auto-scroll";
import Autoplay from "embla-carousel-autoplay";
import Fade from "embla-carousel-fade";

import type { CarouselNode } from "../document/structure-schema";

type MotionProps = Pick<CarouselNode["props"], "autoplay" | "marquee"> & { transition: "fade" | "slide" };

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

const subscribeToReducedMotion = (onChange: () => void) => {
	const query = window.matchMedia(reducedMotionQuery);
	query.addEventListener("change", onChange);

	return () => query.removeEventListener("change", onChange);
};

export const useReducedMotion = () =>
	useSyncExternalStore(
		subscribeToReducedMotion,
		() => window.matchMedia(reducedMotionQuery).matches,
		() => false
	);

export const useCarouselPlugins = ({ autoplay, marquee, transition }: MotionProps) => {
	const reducedMotion = useReducedMotion();
	const autoplayDelay = autoplay?.delay;
	const autoplayPauseOnFocus = autoplay?.pauseOnFocus ?? false;
	const autoplayPauseOnHover = autoplay?.pauseOnHover ?? false;
	const marqueeSpeed = marquee?.speed;
	const marqueeDirection = marquee?.direction ?? "forward";
	const marqueePauseOnHover = marquee?.pauseOnHover ?? true;

	return useMemo(() => {
		const plugins: Array<EmblaPluginType> = [];

		if (autoplayDelay !== undefined && !reducedMotion) {
			plugins.push(
				Autoplay({
					delay: autoplayDelay,
					playOnInit: false,
					stopOnFocusIn: autoplayPauseOnFocus,
					stopOnInteraction: false,
					stopOnMouseEnter: autoplayPauseOnHover,
				})
			);
		}

		if (marqueeSpeed !== undefined && !reducedMotion) {
			plugins.push(
				AutoScroll({
					direction: marqueeDirection,
					playOnInit: false,
					speed: marqueeSpeed,
					startDelay: 0,
					stopOnInteraction: false,
					stopOnMouseEnter: marqueePauseOnHover,
				})
			);
		}

		if (transition === "fade") {
			plugins.push(Fade());
		}

		return plugins;
	}, [
		autoplayDelay,
		autoplayPauseOnFocus,
		autoplayPauseOnHover,
		marqueeDirection,
		marqueePauseOnHover,
		marqueeSpeed,
		reducedMotion,
		transition,
	]);
};

export const useMotionPlayback = ({ api, enabled }: { api: EmblaCarouselType | undefined; enabled: boolean }) => {
	const [inView, setInView] = useState(false);

	useEffect(() => {
		if (!api || !enabled || !("IntersectionObserver" in window)) {
			return;
		}

		const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? false), {
			threshold: 0.25,
		});

		observer.observe(api.rootNode());

		return () => observer.disconnect();
	}, [api, enabled]);

	const synchronize = useEffectEvent((embla: EmblaCarouselType) => {
		const { autoplay, autoScroll } = embla.plugins();
		const scrollable = embla.canScrollNext() || embla.canScrollPrev();

		[autoplay, autoScroll].forEach((plugin) => {
			if (!plugin) {
				return;
			}

			if (inView && scrollable) {
				plugin.play();
			} else {
				plugin.stop();
			}
		});
	});

	useEffect(() => {
		if (!api || !enabled) {
			return;
		}

		synchronize(api);
		api.on("reInit", synchronize);

		return () => {
			api.off("reInit", synchronize);
		};
	}, [api, enabled, inView]);
};

export const useCarouselState = (api: EmblaCarouselType | undefined) => {
	const [state, setState] = useState({ canNext: false, canPrevious: false, selectedIndex: 0, snapCount: 0 });

	const synchronize = useEffectEvent((embla: EmblaCarouselType) =>
		setState({
			canNext: embla.canScrollNext(),
			canPrevious: embla.canScrollPrev(),
			selectedIndex: embla.selectedScrollSnap(),
			snapCount: embla.scrollSnapList().length,
		})
	);

	useEffect(() => {
		if (!api) {
			return;
		}

		const frameId = window.requestAnimationFrame(() => synchronize(api));
		api.on("select", synchronize);
		api.on("reInit", synchronize);

		return () => {
			window.cancelAnimationFrame(frameId);
			api.off("select", synchronize);
			api.off("reInit", synchronize);
		};
	}, [api]);

	return state;
};
