import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/postcss";
import react from "@vitejs/plugin-react";
import type { AcceptedPlugin } from "postcss";
import { z } from "zod";

import { scopePlugins } from "../scripts/postcss-scope.ts";

const config: StorybookConfig = {
	addons: [],
	framework: "@storybook/react-vite",
	stories: ["../src/**/*.stories.@(ts|tsx)"],
	viteFinal: (viteConfig) => {
		viteConfig.plugins = [...(viteConfig.plugins ?? []), react()];
		const tailwindPlugin = z.custom<AcceptedPlugin>().parse(tailwindcss());

		viteConfig.css = {
			...viteConfig.css,
			postcss: { plugins: [tailwindPlugin, ...scopePlugins] },
		};

		return viteConfig;
	},
};

export default config;
