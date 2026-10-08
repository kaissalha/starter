import { describe, expect, it } from "vitest";

import {
	arcPath,
	buildLayout,
	computeYTicks,
	fmtNum,
	getGraphWidth,
	normalizeData,
	polarToCartesian,
	smoothPath,
	truncate,
} from "../../../src/components/ui/graph-utils";
import { defaultTheme } from "../../../src/lib/theme";

describe("graph utils", () => {
	it("computes graph widths with floor rounding and a 100px minimum", () => {
		expect(
			getGraphWidth(defaultTheme, {
				containerPadding: 10,
				pageWidth: 400,
				wrapperPadding: 5,
			})
		).toBe(290);

		expect(
			getGraphWidth(defaultTheme, {
				containerPadding: 400,
			})
		).toBe(100);
	});

	it("normalizes data points into a default series", () => {
		expect(normalizeData([])).toEqual([]);

		expect(
			normalizeData([
				{ label: "Jan", value: 10 },
				{ label: "Feb", value: 15 },
			])
		).toEqual([
			{
				data: [
					{ label: "Jan", value: 10 },
					{ label: "Feb", value: 15 },
				],
				name: "Series 1",
			},
		]);

		expect(
			normalizeData([
				{
					data: [{ label: "Jan", value: 10 }],
					name: "Revenue",
				},
			])
		).toEqual([
			{
				data: [{ label: "Jan", value: 10 }],
				name: "Revenue",
			},
		]);
	});

	it("computes y ticks for flat and ranged values", () => {
		expect(computeYTicks(0, 0, 4)).toEqual([0, 1]);
		expect(computeYTicks(0, 2, 3)).toEqual([0, 1, 2]);
		expect(computeYTicks(-1, 1, 3)).toEqual([-1, 0, 1]);
	});

	it("formats numbers and truncated labels for display", () => {
		expect(fmtNum(1_250_000)).toBe("1.3M");
		expect(fmtNum(4500)).toBe("4.5K");
		expect(fmtNum(3.25)).toBe("3.3");
		expect(fmtNum(8)).toBe("8");
		expect(truncate("Strength", 5)).toBe("Stre…");
		expect(truncate("Core", 10)).toBe("Core");
	});

	it("builds cartesian points and arc paths for pie and donut shapes", () => {
		expect(polarToCartesian(50, 50, 10, 90)).toEqual({ x: 60, y: 50 });
		expect(arcPath({ cx: 50, cy: 50, endAngle: 90, r: 20, startAngle: 0 })).toContain("M 50 50 L");
		expect(arcPath({ cx: 50, cy: 50, endAngle: 450, innerR: 10, r: 20, startAngle: 0 })).toContain("A 10 10");
	});

	it("builds smooth paths for empty, straight, and curved point sets", () => {
		expect(smoothPath([])).toBe("");

		expect(
			smoothPath([
				{ x: 0, y: 0 },
				{ x: 10, y: 10 },
			])
		).toBe("M 0 0 L 10 10");

		expect(
			smoothPath([
				{ x: 0, y: 0 },
				{ x: 10, y: 10 },
				{ x: 20, y: 0 },
			])
		).toContain("C");
	});

	it("builds chart layouts with padded max values and x labels", () => {
		const layout = buildLayout(
			[
				{
					data: [
						{ label: "Jan", value: -5 },
						{ label: "Feb", value: 10 },
					],
					name: "Revenue",
				},
			],
			300,
			200,
			false,
			4
		);

		expect(layout.chartW).toBe(250);
		expect(layout.chartH).toBe(166);
		expect(layout.yMin).toBe(-5);
		expect(layout.yMax).toBeCloseTo(11.2);
		expect(layout.xLabels).toEqual(["Jan", "Feb"]);
		expect(layout.yTicks).toHaveLength(4);
	});
});
