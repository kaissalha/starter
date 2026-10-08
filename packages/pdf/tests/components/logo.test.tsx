import * as React from "react";

import { describe, expect, it, vi } from "vitest";

vi.mock("@react-pdf/renderer", () => ({
	Path: ({ d, fill, stroke, strokeWidth }: { d: string; fill?: string; stroke?: string; strokeWidth?: number }) => ({
		props: { d, fill, stroke, strokeWidth },
		type: "Path",
	}),
	Svg: ({ children, style, viewBox }: { children: React.ReactNode; style: object; viewBox: string }) => ({
		props: { children, style, viewBox },
		type: "Svg",
	}),
	View: ({ children }: { children: React.ReactNode }) => ({
		props: { children },
		type: "View",
	}),
}));

import { Logo } from "../../src/components/logo";

describe("Logo", () => {
	it("applies custom size", () => {
		const result = Logo({ size: 60 });
		const svg = result.props.children;

		expect(svg.props.style.width).toBe(60);
		expect(svg.props.style.height).toBe(60 * 1.3);
	});

	it("applies custom color", () => {
		const result = Logo({ color: "#FF0000" });
		const svg = result.props.children;
		const paths = svg.props.children;

		expect(paths[0].props.fill).toBe("#FF0000");
		expect(paths[1].props.stroke).toBe("#FF0000");
	});
});
