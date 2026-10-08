export const revealInScrollArea = (element: HTMLElement | null | undefined) => {
	const viewport = element?.closest<HTMLElement>("[data-slot=scroll-area-viewport]");

	if (element && viewport) {
		viewport.scrollTo({
			behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
			top: viewport.scrollTop + element.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 12,
		});
	}
};
