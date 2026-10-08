import * as React from "react";

import type { Style } from "@react-pdf/types";
import { describe, expect, it, vi } from "vitest";

vi.mock("@react-pdf/renderer", () => ({
	Font: {
		register: vi.fn(),
	},
	StyleSheet: {
		create: <T extends Record<string, Style>>(styles: T) => styles,
	},
	Text: ({
		children,
		render,
	}: {
		children?: React.ReactNode;
		render?: (props: { pageNumber: number; totalPages: number }) => string;
	}) => {
		if (render) {
			return { props: { children: render({ pageNumber: 1, totalPages: 5 }) }, type: "Text" };
		}

		return { props: { children }, type: "Text" };
	},
	View: ({ children, style }: { children?: React.ReactNode; style?: object }) => ({
		props: { children, style },
		type: "View",
	}),
}));

import { Footer } from "../../src/components/footer";

describe("Footer", () => {
	it("uses custom company name", () => {
		const result = Footer({ companyName: "Test Corp", year: 2026 });

		expect(result).toBeDefined();
		expect(JSON.stringify(result)).toContain("Test Corp");
		expect(JSON.stringify(result)).toContain("2026");
	});
});
