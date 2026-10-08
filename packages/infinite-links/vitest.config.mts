/// <reference types="vitest" />

import react from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

export default defineProject({
	plugins: [react()],
	test: {
		environment: "node",
		include: ["**/*.test.{ts,tsx}"],
	},
});
