import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { websiteBrandPalettePresets } from "@/app/[locale]/dashboard/website/editor/website-brand-options";
import { BrandPalettePicker } from "@/components/brand-palette-picker";

it("labels each palette and reports its stable id while keeping selection controlled", () => {
	const onValueChange = vi.fn();
	const [first, second] = websiteBrandPalettePresets;

	if (!first || !second) {
		throw new Error("Palette coverage requires two presets");
	}

	const props = {
		label: "الألوان",
		onValueChange,
		optionLabel: (index: number) => `لوحة ${index + 1}`,
		presets: [first, second],
		swatches: ["primary", "secondary"] as const,
		value: first.id,
	};

	const { rerender } = render(<BrandPalettePicker {...props} />);
	expect(screen.getByRole("radiogroup", { name: "الألوان" })).toBeInTheDocument();
	expect(screen.getByRole("radio", { name: "لوحة 1" })).toBeChecked();
	fireEvent.click(screen.getByRole("radio", { name: "لوحة 2" }));
	expect(onValueChange.mock.calls[0]?.[0]).toBe(second.id);
	expect(screen.getByRole("radio", { name: "لوحة 1" })).toBeChecked();
	rerender(<BrandPalettePicker {...props} value={second.id} />);
	expect(screen.getByRole("radio", { name: "لوحة 2" })).toBeChecked();
});
