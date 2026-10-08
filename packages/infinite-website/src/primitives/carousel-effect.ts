import type { EmblaCarouselType } from "embla-carousel";

import type { CarouselNode } from "../document/structure-schema";

type SlideEffect = NonNullable<CarouselNode["props"]["slideEffect"]>;

const slideDistance = ({ api, index }: { api: EmblaCarouselType; index: number }) => {
	const engine = api.internalEngine();
	const progress = api.scrollProgress();
	const snap = api.scrollSnapList()[index] ?? 0;
	const loopPoint = engine.slideLooper.loopPoints.find((point) => point.index === index);
	const target = loopPoint?.target() ?? 0;

	if (target < 0) {
		return Math.abs((snap - (1 + progress)) * api.scrollSnapList().length);
	}

	if (target > 0) {
		return Math.abs((snap + (1 - progress)) * api.scrollSnapList().length);
	}

	return Math.abs((snap - progress) * api.scrollSnapList().length);
};

const aspectAt = ({ distance, effect }: { distance: number; effect: NonNullable<SlideEffect["aspectRatio"]> }) => {
	if (distance <= 1) {
		return effect.center + (effect.side - effect.center) * distance;
	}

	if (distance <= 2) {
		return effect.side + (effect.edge - effect.side) * (distance - 1);
	}

	return effect.edge;
};

const opacityAt = ({ distance, side }: { distance: number; side: number }) =>
	distance <= 1 ? 1 - (1 - side) * distance : side;

export const slideEffectValues = ({ distance, effect }: { distance: number; effect: SlideEffect }) => ({
	aspectRatio: effect.aspectRatio ? aspectAt({ distance, effect: effect.aspectRatio }) : undefined,
	opacity: effect.opacity ? opacityAt({ distance, side: effect.opacity.side }) : undefined,
});

export const applySlideEffect = ({ api, effect }: { api: EmblaCarouselType; effect: SlideEffect }) => {
	api.slideNodes().forEach((slide, index) => {
		const target = slide.firstElementChild;

		if (!(target instanceof HTMLElement)) {
			return;
		}

		const values = slideEffectValues({ distance: slideDistance({ api, index }), effect });

		if (values.aspectRatio !== undefined) {
			target.style.aspectRatio = String(values.aspectRatio);
		}

		if (values.opacity !== undefined) {
			target.style.opacity = String(values.opacity);
		}
	});
};
