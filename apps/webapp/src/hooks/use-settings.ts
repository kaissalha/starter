"use client";

import { useCallback } from "react";

import { createParser, useQueryState } from "nuqs";

import { useIsMobile } from "@starter/ui/hooks/use-is-mobile";

const settings = ["list", "profile", "display", "organization", "team", "notifications", "developers"] as const;

export type Settings = (typeof settings)[number];

const parseAsSettings = createParser({
	parse: (value: string | null) => {
		if (!value) {
			return null;
		}

		return settings.find((setting) => setting === value) ?? null;
	},
	serialize: (value: Settings | null) => value ?? "",
});

export const useSettings = () => {
	const isMobile = useIsMobile();
	const [settings, setSettings] = useQueryState("settings", parseAsSettings);

	const setActiveSetting = useCallback(
		(setting: Settings | null) => {
			if (setting === "list" && !isMobile) {
				setSettings("profile");

				return;
			}

			setSettings(setting);
		},
		[isMobile, setSettings]
	);

	return [settings === "list" && !isMobile ? "profile" : settings, setActiveSetting] as const;
};
