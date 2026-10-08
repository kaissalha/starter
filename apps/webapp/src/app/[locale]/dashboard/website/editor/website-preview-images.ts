import { useWebsiteGenerationStore } from "../generation/website-generation-store";

const WEBSITE_IMAGE_PLACEHOLDER = "/website-image-placeholder.svg";

const loadedImageSources = new Set<string>();

const updateImageReadiness = ({
	forceReady = false,
	image,
	sectionId,
}: {
	forceReady?: boolean;
	image: HTMLImageElement;
	sectionId: string;
}) => {
	const frame = image.closest<HTMLElement>(".iw-media-frame");

	if (!frame) {
		return;
	}

	const state = useWebsiteGenerationStore.getState();
	const readiness = state.readiness[sectionId];
	const source = image.currentSrc || image.src;

	const assetId =
		readiness && state.snapshot
			? readiness.assetIds.find((candidate) => {
					const asset = state.snapshot?.assets[candidate];

					return asset && new URL(asset.src, window.location.origin).href === source;
				})
			: undefined;

	const eventSettled = assetId ? Boolean(state.completedEventKeys[`asset:${assetId}`]) : false;

	const ready =
		forceReady ||
		!assetId ||
		Boolean(readiness?.resolvedAssetIds[assetId]) ||
		(loadedImageSources.has(source) && eventSettled);

	frame.dataset.websiteMediaReady = ready ? "true" : "false";

	if (ready) {
		frame.removeAttribute("aria-busy");
	} else {
		frame.setAttribute("aria-busy", "true");
	}

	if (assetId && eventSettled && (forceReady || loadedImageSources.has(source))) {
		state.markAssetLoaded({ assetId, sectionId });
	}
};

export const revealWebsitePreviewImage = ({ image }: { image: HTMLImageElement }) => {
	if (!image.complete || image.naturalWidth === 0) {
		return;
	}

	const sectionId = image.closest<HTMLElement>("[data-website-section-id]")?.dataset.websiteSectionId;

	if (!sectionId) {
		return;
	}

	const source = image.currentSrc || image.src;

	if (source === new URL(WEBSITE_IMAGE_PLACEHOLDER, window.location.origin).href) {
		updateImageReadiness({ image, sectionId });

		return;
	}

	loadedImageSources.add(source);
	document.querySelectorAll<HTMLImageElement>("[data-website-section-id] img").forEach((candidate) => {
		const candidateSectionId =
			candidate.closest<HTMLElement>("[data-website-section-id]")?.dataset.websiteSectionId;

		if ((candidate.currentSrc || candidate.src) === source && candidateSectionId) {
			updateImageReadiness({ image: candidate, sectionId: candidateSectionId });
		}
	});
};

export const recoverWebsitePreviewImage = ({ image }: { image: HTMLImageElement }) => {
	const sectionId = image.closest<HTMLElement>("[data-website-section-id]")?.dataset.websiteSectionId;

	if (!sectionId) {
		return;
	}

	updateImageReadiness({ forceReady: true, image, sectionId });

	if (!image.src.endsWith(WEBSITE_IMAGE_PLACEHOLDER)) {
		image.src = WEBSITE_IMAGE_PLACEHOLDER;
	}
};

export const synchronizeWebsitePreviewImages = ({
	element,
	sectionId,
}: {
	element: HTMLElement;
	sectionId: string;
}) => {
	element.querySelectorAll("img").forEach((image) => {
		const source = image.currentSrc || image.src;
		updateImageReadiness({ image, sectionId });

		if (!loadedImageSources.has(source) && image.complete) {
			revealWebsitePreviewImage({ image });
		}
	});
};
