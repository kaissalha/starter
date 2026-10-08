import tailwindcss from "@tailwindcss/postcss";
import postcss from "postcss";

import { scopePlugins } from "./postcss-scope";

export const compileWebsiteStyles = async ({
	from,
	input,
	optimize,
	to,
}: {
	from: string;
	input: string;
	optimize: boolean;
	to: string;
}) => {
	const result = await postcss([tailwindcss({ optimize }), ...scopePlugins]).process(input, { from, map: false, to });

	return result.css;
};
