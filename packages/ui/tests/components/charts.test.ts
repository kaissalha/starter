import { createElement } from "react";

import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SpectrumChart } from "../../src/components/charts/genui-charts";

describe.each(["line", "area", "bar", "composed", "pie", "radar", "radial"] as const)("Spectrum %s chart", (kind) => {
	it("keeps labels and exact numeric values paired in the accessible table", async () => {
		const { findByRole, unmount } = render(
			createElement(SpectrumChart, {
				kind,
				labels: ["Sep 20", "Sep 21"],
				series: [{ category: "Visitors", values: [0, 0.0001] }],
			})
		);

		const rows = [...(await findByRole("table", {}, { timeout: 5000 })).querySelectorAll("tbody tr")];
		expect(rows.map((row) => [...row.children].map((cell) => cell.textContent))).toEqual([
			["Sep 20", "0"],
			["Sep 21", "0.0001"],
		]);
		unmount();
	});
	it("does not render incomplete streamed series", async () => {
		const { container, unmount } = render(
			createElement(SpectrumChart, {
				kind,
				labels: ["Sep 20", "Sep 21"],
				series: [{ category: "Visitors", values: [10] }],
			})
		);

		await waitFor(() => expect(container.children).toHaveLength(0));
		unmount();
	});
});

it.each(["pie", "radial", "radar"] as const)("rejects negative %s data", async (kind) => {
	const { container, unmount } = render(
		createElement(SpectrumChart, {
			kind,
			labels: ["A"],
			series: [{ category: "Values", values: [-1] }],
		})
	);

	await waitFor(() => expect(container.children).toHaveLength(0));
	unmount();
});
