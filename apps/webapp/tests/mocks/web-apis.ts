class ResizeObserverMock {
	observe() {}

	unobserve() {}

	disconnect() {}
}

global.ResizeObserver = ResizeObserverMock;

if (globalThis.Element) {
	Element.prototype.getAnimations = () => [];
}

class IntersectionObserverMock {
	readonly root: Element | Document | null = null;
	readonly rootMargin = "";
	readonly scrollMargin = "";
	readonly thresholds: ReadonlyArray<number> = [];

	observe() {}

	unobserve() {}

	disconnect() {}

	takeRecords() {
		return [];
	}
}

global.IntersectionObserver = IntersectionObserverMock;
