import type { Style } from "@react-pdf/types";
import { describe, expect, it, vi } from "vitest";

vi.mock("@react-pdf/renderer", () => ({
	Font: {
		register: vi.fn(),
	},
	StyleSheet: {
		create: <T extends Record<string, Style>>(styles: T) => styles,
	},
	Text: ({ children, style, wrap }: { children?: unknown; style?: unknown; wrap?: boolean }) => ({
		props: { children, style, wrap },
		type: "Text",
	}),
	View: ({
		children,
		minPresenceAhead,
		style,
		wrap,
	}: {
		children?: unknown;
		minPresenceAhead?: number;
		style?: unknown;
		wrap?: boolean;
	}) => ({
		props: { children, minPresenceAhead, style, wrap },
		type: "View",
	}),
}));

import { Badge } from "../../../src/components/ui/badge";
import { KeyValue } from "../../../src/components/ui/key-value";
import { Stack } from "../../../src/components/ui/stack";
import { defaultTheme } from "../../../src/lib/theme";

describe("pdf ui primitives", () => {
	it("renders Stack with directional, alignment, justify, wrap, and custom styles", () => {
		const result = Stack({
			align: "center",
			children: "Row",
			direction: "horizontal",
			gap: "xl",
			justify: "between",
			noWrap: true,
			style: { marginTop: 12, paddingBottom: 4 },
			wrap: true,
		});

		expect(result.props.wrap).toBe(false);

		expect(result.props.style).toEqual([
			{ flexDirection: "row" },
			{ gap: defaultTheme.primitives.spacing[8] },
			{ alignItems: "center" },
			{ justifyContent: "space-between" },
			{ flexWrap: "wrap" },
			{ marginTop: 12, paddingBottom: 4 },
		]);
	});

	it("renders Badge with resolved theme colors and custom overrides", () => {
		const result = Badge({
			background: "primary",
			children: "Fallback child",
			color: "warning",
			label: "Preferred label",
			size: "lg",
			style: { marginRight: 6 },
			variant: "outline",
		});

		const text = result.props.children;

		expect(result.props.style).toEqual([
			expect.objectContaining({
				alignSelf: "flex-start",
				borderRadius: defaultTheme.primitives.borderRadius.full,
			}),
			{
				backgroundColor: defaultTheme.colors.background,
				borderColor: defaultTheme.colors.border,
				borderStyle: "solid",
				borderWidth: 1,
			},
			{
				paddingHorizontal: defaultTheme.primitives.spacing[3],
				paddingVertical: defaultTheme.primitives.spacing[1],
			},
			{ backgroundColor: defaultTheme.colors.primary },
			{ marginRight: 6 },
		]);

		expect(text.props.children).toBe("Preferred label");
		expect(text.props.wrap).toBe(false);

		expect(text.props.style).toEqual([
			{
				color: defaultTheme.colors.mutedForeground,
				fontFamily: "Geist",
				fontWeight: defaultTheme.primitives.fontWeights.semibold,
				letterSpacing: 0,
			},
			{ fontSize: 14, lineHeight: 1.2 },
			{ color: defaultTheme.colors.warning },
		]);
	});

	it("renders KeyValue rows horizontally with dividers and bold values", () => {
		const result = KeyValue({
			boldValue: true,
			direction: "horizontal",
			divided: true,
			dividerColor: "warning",
			dividerMargin: 9,
			dividerThickness: 3,
			items: [
				{
					key: "Status",
					keyStyle: { textTransform: "uppercase" },
					value: "Ready",
					valueStyle: { letterSpacing: 0.4 },
				},
				{
					key: "Owner",
					value: "Dr. Rivera",
				},
			],
			labelColor: "mutedForeground",
			labelFlex: 2,
			noWrap: true,
			size: "lg",
			style: { marginTop: 4 },
			valueColor: "success",
		});

		const [firstRow, secondRow] = result.props.children;
		const [firstKey, firstValue] = firstRow.props.children;
		const [secondKey, secondValue] = secondRow.props.children;

		expect(result.props.wrap).toBe(false);
		expect(result.props.style).toEqual([{ flexDirection: "column" }, { marginTop: 4 }]);

		expect(firstRow.props.style).toEqual([
			{ alignItems: "flex-start", flexDirection: "row", paddingVertical: defaultTheme.primitives.spacing[1] },
			{
				borderBottomColor: defaultTheme.colors.warning,
				borderBottomStyle: "solid",
				borderBottomWidth: 3,
				marginBottom: 9,
			},
		]);

		expect(firstKey.props.style).toEqual([
			{
				color: defaultTheme.colors.mutedForeground,
				fontFamily: defaultTheme.typography.body.fontFamily,
				fontSize: defaultTheme.primitives.typography.base,
				fontWeight: defaultTheme.primitives.fontWeights.medium,
			},
			{ color: defaultTheme.colors.mutedForeground },
			{ textTransform: "uppercase" },
			{ flex: 2 },
		]);

		expect(firstValue.props.style).toEqual([
			{
				color: defaultTheme.colors.foreground,
				fontFamily: defaultTheme.typography.body.fontFamily,
				fontSize: defaultTheme.primitives.typography.base,
				fontWeight: defaultTheme.primitives.fontWeights.regular,
			},
			{ fontWeight: defaultTheme.primitives.fontWeights.bold },
			{ color: defaultTheme.colors.success },
			{ letterSpacing: 0.4 },
			{ flex: 1, textAlign: "right" },
		]);

		expect(secondKey.props.style.at(-1)).toEqual({ flex: 2 });
		expect(secondValue.props.style.at(-1)).toEqual({ flex: 1, textAlign: "right" });
	});

	it("renders KeyValue rows vertically and lets item colors override the shared value color", () => {
		const result = KeyValue({
			direction: "vertical",
			divided: true,
			items: [
				{
					key: "Priority",
					value: "Critical",
					valueColor: "destructive",
				},
				{
					key: "Window",
					value: "2 weeks",
				},
			],
			valueColor: "info",
		});

		const [firstRow, secondRow] = result.props.children;
		const [firstKey, firstValue] = firstRow.props.children;
		const [, secondValue] = secondRow.props.children;

		expect(firstRow.props.style).toEqual([
			{ flexDirection: "column", marginBottom: defaultTheme.spacing.paragraphGap },
			{
				borderBottomColor: defaultTheme.colors.border,
				borderBottomStyle: "solid",
				borderBottomWidth: defaultTheme.primitives.spacing[0.5],
			},
		]);

		expect(firstKey.props.children).toBe("Priority");

		expect(firstValue.props.style).toEqual([
			{
				color: defaultTheme.colors.foreground,
				fontFamily: defaultTheme.typography.body.fontFamily,
				fontSize: defaultTheme.typography.body.fontSize,
				fontWeight: defaultTheme.primitives.fontWeights.regular,
			},
			{ color: defaultTheme.colors.destructive },
		]);

		expect(secondValue.props.style).toEqual([
			{
				color: defaultTheme.colors.foreground,
				fontFamily: defaultTheme.typography.body.fontFamily,
				fontSize: defaultTheme.typography.body.fontSize,
				fontWeight: defaultTheme.primitives.fontWeights.regular,
			},
			{ color: defaultTheme.colors.info },
		]);
	});
});
