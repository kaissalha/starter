import { useSyncExternalStore } from "react";

const subscribe = () => {
	return () => {};
};

const getClientSnapshot = () => {
	return true;
};

const getServerSnapshot = () => {
	return false;
};

export const useHydrated = () => {
	return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
};
