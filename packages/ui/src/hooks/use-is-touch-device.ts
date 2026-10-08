"use client";

import { useSyncExternalStore } from "react";

const TOUCH_POINTER_QUERY = "(any-pointer: coarse)";

const subscribe = (onStoreChange: () => void) => {
	const mediaQuery = window.matchMedia(TOUCH_POINTER_QUERY);
	mediaQuery.addEventListener("change", onStoreChange);

	return () => mediaQuery.removeEventListener("change", onStoreChange);
};

const getSnapshot = () => window.matchMedia(TOUCH_POINTER_QUERY).matches || navigator.maxTouchPoints > 0;

export const useIsTouchDevice = () => {
	return useSyncExternalStore(subscribe, getSnapshot, () => false);
};
