import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/postcss";
import react from "@vitejs/plugin-react";
import type { AcceptedPlugin } from "postcss";
import { z } from "zod";

const config: StorybookConfig = {
	addons: [],
	framework: "@storybook/react-vite",
	stories: ["../src/**/*.stories.@(ts|tsx)"],
	viteFinal: (viteConfig) => {
		viteConfig.plugins = [...(viteConfig.plugins ?? []), react()];
		viteConfig.css = {
			...viteConfig.css,
			postcss: { plugins: [z.custom<AcceptedPlugin>().parse(tailwindcss())] },
		};

		return viteConfig;
	},
};

export default config;
