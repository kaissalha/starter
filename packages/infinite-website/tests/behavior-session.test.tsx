// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const scriptMocks = vi.hoisted(() => ({
	createSession: vi.fn(),
	dispose: vi.fn(),
	evaluate: vi.fn(({ inputs }: { inputs: Record<string, string> }) => ({ result: inputs.count ?? "0" })),
	interact: vi.fn(),
}));

vi.mock("../src/behavior/custom-script", () => ({
	createSiteScriptSession: scriptMocks.createSession,
	siteScriptProgramInputs: ({ slots }: { slots: Record<string, string> }) => slots,
}));

import type { SiteBehaviorProgramV1 } from "../src/behavior/contracts";
import { BehaviorField, BehaviorRuntimeBoundary, BehaviorTrigger, BehaviorValue } from "../src/behavior/runtime";

type ScriptSession = {
	dispose: typeof scriptMocks.dispose;
	evaluate: typeof scriptMocks.evaluate;
	interact: typeof scriptMocks.interact;
};

const program: SiteBehaviorProgramV1 = {
	behaviorVersion: 1,
	expressionProfile: "custom-js-v1",
	initialOutputs: { result: "3" },
	outputs: ["result"],
	script: "function calculate(inputs) { return inputs.count; }",
	slots: [{ initial: "3", key: "count" }],
};

const BehaviorDemo = () => (
	<BehaviorRuntimeBoundary program={program}>
		<BehaviorField invalid='Invalid' slot='count'>
			<span>Count</span>
		</BehaviorField>
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

beforeEach(() => {
	vi.clearAllMocks();

	scriptMocks.createSession.mockResolvedValue({
		dispose: scriptMocks.dispose,
		evaluate: scriptMocks.evaluate,
		interact: scriptMocks.interact,
	});
});

describe("behavior script sessions", () => {
	it("disables fields and triggers until the script session is ready", async () => {
		const session = Promise.withResolvers<ScriptSession>();
		scriptMocks.createSession.mockReturnValue(session.promise);

		const eventProgram: SiteBehaviorProgramV1 = {
			...program,
			events: ["open"],
			targets: { open: "details" },
		};

		const { unmount } = render(
			<BehaviorRuntimeBoundary program={eventProgram}>
				<BehaviorField slot='count'>Count</BehaviorField>
				<BehaviorTrigger event='open' label='Open'>
					Open
				</BehaviorTrigger>
			</BehaviorRuntimeBoundary>
		);

		const field = screen.getByRole("textbox", { name: "Count" });
		const trigger = screen.getByRole("button", { name: "Open" });
		expect(field).toHaveProperty("disabled", true);
		expect(trigger.getAttribute("aria-disabled")).toBe("true");
		fireEvent.click(trigger);
		expect(scriptMocks.interact).not.toHaveBeenCalled();

		session.resolve({
			dispose: scriptMocks.dispose,
			evaluate: scriptMocks.evaluate,
			interact: scriptMocks.interact,
		});

		await waitFor(() => expect(field).toHaveProperty("disabled", false));
		expect(trigger.getAttribute("aria-disabled")).toBeNull();
		fireEvent.click(trigger);
		expect(scriptMocks.interact).toHaveBeenCalledWith({ event: "open" });
		unmount();
	});

	it("keeps script controls disabled when session initialization fails", async () => {
		scriptMocks.createSession.mockResolvedValue(null);

		const { unmount } = render(
			<BehaviorRuntimeBoundary program={program}>
				<BehaviorField slot='count'>Failed count</BehaviorField>
				<BehaviorTrigger event='open' label='Failed trigger'>
					Failed trigger
				</BehaviorTrigger>
			</BehaviorRuntimeBoundary>
		);

		await waitFor(() => expect(scriptMocks.createSession).toHaveBeenCalledTimes(1));
		expect(screen.getByRole("textbox", { name: "Failed count" })).toHaveProperty("disabled", true);
		expect(screen.getByRole("button", { name: "Failed trigger" }).getAttribute("aria-disabled")).toBe("true");
		unmount();
	});

	it("creates one session and reuses it across input changes", async () => {
		const { unmount } = render(<BehaviorDemo />);

		await waitFor(() => expect(scriptMocks.createSession).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(scriptMocks.evaluate).toHaveBeenCalledTimes(1));

		const field = screen.getByRole("textbox", { name: "Count" });
		fireEvent.change(field, { target: { value: "4" } });
		fireEvent.change(field, { target: { value: "5" } });

		await waitFor(() => expect(screen.getByText("5")).toBeTruthy());
		expect(scriptMocks.createSession).toHaveBeenCalledTimes(1);

		unmount();
		expect(scriptMocks.dispose).toHaveBeenCalledTimes(1);
	});

	it("disables controls when reevaluation no longer produces outputs", async () => {
		scriptMocks.evaluate.mockReturnValueOnce({ result: "3" }).mockReturnValueOnce(null);
		render(<BehaviorDemo />);

		const field = await screen.findByRole("textbox", { name: "Count" });
		await waitFor(() => expect(field).toHaveProperty("disabled", false));
		fireEvent.change(field, { target: { value: "4" } });
		await waitFor(() => expect(field).toHaveProperty("disabled", true));
		expect(screen.getByText("Unavailable")).toBeTruthy();
	});

	it("disposes a session that resolves after unmount", async () => {
		const session = Promise.withResolvers<ScriptSession>();
		scriptMocks.createSession.mockReturnValue(session.promise);

		const { unmount } = render(<BehaviorDemo />);
		await waitFor(() => expect(scriptMocks.createSession).toHaveBeenCalledTimes(1));
		unmount();

		session.resolve({
			dispose: scriptMocks.dispose,
			evaluate: scriptMocks.evaluate,
			interact: scriptMocks.interact,
		});

		await waitFor(() => expect(scriptMocks.dispose).toHaveBeenCalledTimes(1));
	});
});
