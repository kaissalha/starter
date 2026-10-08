// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SiteBehaviorProgramV1 } from "../src/behavior/contracts";
import { BehaviorField, BehaviorRuntimeBoundary, BehaviorTrigger, BehaviorValue } from "../src/behavior/runtime";

const sum = {
	lhs: { key: "base", type: "reference" as const },
	operator: "+" as const,
	rhs: { key: "extra", type: "reference" as const },
	type: "binary" as const,
};

const program: SiteBehaviorProgramV1 = {
	behaviorVersion: 1,
	expressionProfile: "site-expression-v1",
	result: sum,
	slots: [
		{ initial: "0.1", key: "base" },
		{ initial: "0.2", key: "extra" },
	],
	source: "base + extra",
};

describe("behavior runtime", () => {
	it("preserves incomplete raw input and recomputes after a valid decimal event", () => {
		const behavior = (nextProgram: SiteBehaviorProgramV1) => (
			<BehaviorRuntimeBoundary program={nextProgram}>
				<BehaviorField invalid='Enter a valid decimal' placeholder='0.1' slot='base'>
					<span>Base</span>
				</BehaviorField>
				<BehaviorValue
					format={{ maximumFractionDigits: 2, style: "decimal" }}
					locale='en'
					unavailable='Unavailable'
					value='result'
				>
					<span>Total</span>
				</BehaviorValue>
			</BehaviorRuntimeBoundary>
		);

		const { rerender } = render(behavior(program));

		const field = screen.getByRole("textbox", { name: "Base" });
		expect(field.getAttribute("maxlength")).toBe("400");
		expect(screen.getByText("0.3")).toBeTruthy();

		fireEvent.change(field, { target: { value: "-" } });
		expect(field.getAttribute("aria-invalid")).toBe("true");
		expect(screen.getByRole("alert").textContent).toBe("Enter a valid decimal");
		expect(screen.getByText("0.3")).toBeTruthy();

		fireEvent.change(field, { target: { value: "1.5" } });
		expect(field.getAttribute("aria-invalid")).toBe("false");
		expect(screen.getByText("1.7")).toBeTruthy();

		fireEvent.change(field, { target: { value: "١٫٥" } });
		expect(field.getAttribute("aria-invalid")).toBe("false");
		expect(screen.getByText("1.7")).toBeTruthy();

		rerender(behavior(structuredClone(program)));
		expect(screen.getByText("1.7")).toBeTruthy();
	});

	it("uses an explicit empty value without rendering a validation message", () => {
		render(
			<BehaviorRuntimeBoundary program={program}>
				<BehaviorField emptyValue='0' slot='base'>
					<span>Empty base</span>
				</BehaviorField>
				<BehaviorValue
					format={{ maximumFractionDigits: 2, style: "decimal" }}
					locale='en'
					unavailable='Unavailable'
					value='result'
				>
					<span>Total</span>
				</BehaviorValue>
			</BehaviorRuntimeBoundary>
		);

		const field = screen.getByRole("textbox", { name: "Empty base" });
		fireEvent.change(field, { target: { value: "" } });

		expect(field.getAttribute("aria-invalid")).toBe("false");
		expect(screen.queryByRole("alert")).toBeNull();
		expect(screen.getByText("0.2")).toBeTruthy();
	});

	it("formats exact decimals without coercing through a host Number", () => {
		const exactProgram: SiteBehaviorProgramV1 = {
			behaviorVersion: 1,
			expressionProfile: "site-expression-v1",
			result: { key: "amount", type: "reference" },
			slots: [{ initial: "9007199254740993", key: "amount" }],
			source: "amount",
		};

		render(
			<BehaviorRuntimeBoundary program={exactProgram}>
				<BehaviorValue
					format={{ maximumFractionDigits: 0, style: "decimal" }}
					locale='en'
					unavailable='Unavailable'
					value='result'
				>
					<span>Total</span>
				</BehaviorValue>
			</BehaviorRuntimeBoundary>
		);

		expect(screen.getByText("9,007,199,254,740,993")).toBeTruthy();
	});

	it.each([
		[{ maximumFractionDigits: 1, style: "percent" as const, valueScale: "ratio" as const }, "0.125"],
		[{ maximumFractionDigits: 1, style: "percent" as const, valueScale: "percentage-points" as const }, "12.5"],
	])("formats percent values with an explicit scale", (format, initial) => {
		const percentProgram: SiteBehaviorProgramV1 = {
			behaviorVersion: 1,
			expressionProfile: "site-expression-v1",
			result: { key: "rate", type: "reference" },
			slots: [{ initial, key: "rate" }],
			source: "rate",
		};

		const { container } = render(
			<BehaviorRuntimeBoundary program={percentProgram}>
				<BehaviorValue
					emphasis='secondary'
					format={format}
					locale='en'
					unavailable='Unavailable'
					value='result'
				>
					<span>Rate</span>
				</BehaviorValue>
			</BehaviorRuntimeBoundary>
		);

		expect(container.querySelector("strong")?.textContent).toBe("12.5%");
	});

	it("recomputes custom script programs in the sandbox as fields change", async () => {
		const scriptProgram: SiteBehaviorProgramV1 = {
			behaviorVersion: 1,
			expressionProfile: "custom-js-v1",
			initialOutputs: { result: "6" },
			outputs: ["result"],
			script: "function calculate(inputs) { let total = 0; for (let index = 1; index <= inputs.count; index += 1) { total += index; } return total; }",
			slots: [{ initial: "3", key: "count" }],
		};

		render(
			<BehaviorRuntimeBoundary program={scriptProgram}>
				<BehaviorField invalid='Enter a valid decimal' slot='count'>
					<span>Count</span>
				</BehaviorField>
				<BehaviorValue
					format={{ maximumFractionDigits: 2, style: "decimal" }}
					locale='en'
					unavailable='Unavailable'
					value='result'
				>
					<span>Total</span>
				</BehaviorValue>
			</BehaviorRuntimeBoundary>
		);

		expect(screen.getByText("6")).toBeTruthy();

		fireEvent.change(screen.getByRole("textbox", { name: "Count" }), { target: { value: "4" } });
		expect(await screen.findByText("10", undefined, { timeout: 25_000 })).toBeTruthy();
	});

	it("exposes named script outputs beyond result to value bindings", async () => {
		const namedProgram: SiteBehaviorProgramV1 = {
			behaviorVersion: 1,
			expressionProfile: "custom-js-v1",
			initialOutputs: { doubled: "0", result: "0" },
			outputs: ["result", "doubled"],
			script: "function calculate(inputs) { return { result: inputs.base, doubled: inputs.base * 2 }; }",
			slots: [{ initial: "24", key: "base" }],
		};

		render(
			<BehaviorRuntimeBoundary program={namedProgram}>
				<BehaviorValue
					format={{ maximumFractionDigits: 0, style: "decimal" }}
					locale='en'
					unavailable='Unavailable'
					value='doubled'
				>
					<span>Doubled</span>
				</BehaviorValue>
			</BehaviorRuntimeBoundary>
		);

		await waitFor(
			() => {
				expect(screen.getByText("48")).toBeTruthy();
			},
			{ timeout: 25_000 }
		);
	});

	it("runs a declared trigger event and scrolls to its resolved section anchor", async () => {
		const scrollIntoView = vi.fn();

		const scriptProgram: SiteBehaviorProgramV1 = {
			behaviorVersion: 1,
			events: ["image_click"],
			expressionProfile: "custom-js-v1",
			initialOutputs: { result: "1" },
			outputs: ["result"],
			script: `
function calculate(inputs) { return inputs.count; }
function interact(event) {
	return event === "image_click" ? { type: "scroll-to", anchor: "more-than-a-coffee-stop" } : null;
}`,
			slots: [{ initial: "1", key: "count" }],
			targets: { image_click: "more-than-a-coffee-stop" },
		};

		const { container } = render(
			<>
				<BehaviorRuntimeBoundary program={scriptProgram}>
					<BehaviorTrigger event='image_click' label='View details'>
						<span>Photo</span>
					</BehaviorTrigger>
				</BehaviorRuntimeBoundary>
				<div data-website-anchor='more-than-a-coffee-stop'>Details</div>
			</>
		);

		const target = container.querySelector<HTMLElement>("[data-website-anchor='more-than-a-coffee-stop']");

		if (!target) {
			throw new Error("Target element not found");
		}

		target.scrollIntoView = scrollIntoView;

		await waitFor(
			() => {
				fireEvent.click(screen.getByRole("button", { name: "View details" }));
				expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
			},
			{ timeout: 25_000 }
		);
	});
});
