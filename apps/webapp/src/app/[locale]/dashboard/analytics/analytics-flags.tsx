"use client";

import { createElement } from "react";

import * as Flags from "country-flag-icons/react/1x1";

const flags = new Map(Object.entries(Flags));

export const AnalyticsFlagIcon = ({ country }: { country: string }) => {
	const flag = flags.get(country);

	return flag ? createElement(flag, { className: "size-full" }) : null;
};
