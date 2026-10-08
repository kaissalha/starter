import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import "@testing-library/jest-dom/vitest";

const createStorage = () => {
	const store = new Map<string, string>();

	return {
		clear: () => {
			store.clear();
		},
		getItem: (key: string) => {
			return store.get(key) ?? null;
		},
		key: (index: number) => {
			return Array.from(store.keys())[index] ?? null;
		},
		get length() {
			return store.size;
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
		setItem: (key: string, value: string) => {
			store.set(String(key), String(value));
		},
	} satisfies Storage;
};

const installStorage = ({ key, value }: { key: "localStorage" | "sessionStorage"; value: Storage }) => {
	Object.defineProperty(window, key, {
		configurable: true,
		value,
		writable: true,
	});

	Object.defineProperty(globalThis, key, {
		configurable: true,
		value,
		writable: true,
	});
};

const localStorageMock = createStorage();

const sessionStorageMock = createStorage();

type MatchMedia = Window["matchMedia"];

installStorage({
	key: "localStorage",
	value: localStorageMock,
});

installStorage({
	key: "sessionStorage",
	value: sessionStorageMock,
});

if (!window.matchMedia) {
	const matchMedia: MatchMedia = (query: string) => {
		const mediaQueryList: MediaQueryList = {
			addEventListener: () => undefined,
			addListener: () => undefined,
			dispatchEvent: () => false,
			matches: false,
			media: query,
			onchange: null,
			removeEventListener: () => undefined,
			removeListener: () => undefined,
		};

		return mediaQueryList;
	};

	window.matchMedia = matchMedia;
}

afterEach(() => {
	cleanup();
	localStorageMock.clear();
	sessionStorageMock.clear();
});
