"use client";

import { useEffect } from "react";

export const DashboardThemeScope = () => {
	useEffect(
		() => () => {
			document.documentElement.classList.remove("light", "dark");
			document.documentElement.style.colorScheme = "";
		},
		[]
	);

	return null;
};
