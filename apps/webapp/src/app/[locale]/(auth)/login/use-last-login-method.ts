"use client";

import { useSyncExternalStore } from "react";

import { authClient } from "@/lib/auth-client";

const subscribeToLastLoginMethod = () => {
	return () => undefined;
};

const getServerSnapshot = () => {
	return null;
};

export const useLastLoginMethod = () => {
	return useSyncExternalStore(
		subscribeToLastLoginMethod,
		() => authClient.getLastUsedLoginMethod(),
		getServerSnapshot
	);
};
