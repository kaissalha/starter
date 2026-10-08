import Decimal from "decimal.js";
import type { InterruptHandler, QuickJSContext, QuickJSRuntime } from "quickjs-emscripten";
import { z } from "zod";

import { anchorSchema } from "../document/content-schema";
import { decimalValueSchema, type SiteScriptProgramV1 } from "./contracts";

type MutableReference<Value> = { value: Value };

const LOAD_DEADLINE_MS = 50;

const CALL_DEADLINE_MS = 25;

const MEMORY_LIMIT_BYTES = 8 * 1024 * 1024;

const STACK_LIMIT_BYTES = 512 * 1024;

const prelude = 'Math.random = () => { throw new Error("random is unavailable"); };';

const finiteNumberSchema = z.compile(z.number().finite());

const stringSchema = z.compile(z.string());

const outputRecordSchema = z.compile(z.record(z.string(), finiteNumberSchema));

const interactionCommandSchema = z.compile(z.strictObject({ anchor: anchorSchema, type: z.literal("scroll-to") }));

export type SiteScriptOutputs = Record<string, string>;

export type SiteScriptCommand = { anchor: string; type: "scroll-to" };

export type SiteScriptSession = {
	dispose: () => void;
	evaluate: (call: { inputs: Record<string, string> }) => SiteScriptOutputs | null;
	interact: (call: { event: string }) => SiteScriptCommand | null;
};

const quickJsModuleReference: MutableReference<Promise<typeof import("quickjs-emscripten")> | null> = { value: null };

const parseOutputs = ({ dumped, outputs }: { dumped: unknown; outputs: Array<string> }): SiteScriptOutputs | null => {
	const raw: unknown = JSON.parse(stringSchema.parse(dumped));
	const single = finiteNumberSchema.safeParse(raw);
	const firstOutput = outputs[0] ?? "result";
	const record = outputRecordSchema.safeParse(single.success ? { [firstOutput]: single.data } : raw);

	if (!record.success) {
		return null;
	}

	const normalized: SiteScriptOutputs = {};

	for (const output of outputs) {
		const value = record.data[output];

		if (value === undefined) {
			return null;
		}

		const serialized = new Decimal(value).toFixed();

		const decimal = decimalValueSchema.safeParse(serialized);

		if (!decimal.success) {
			return null;
		}

		normalized[output] = decimal.data;
	}

	return normalized;
};

const callScript = ({
	code,
	context,
	deadline,
	outputs,
	runtime,
}: {
	code: string;
	context: QuickJSContext;
	deadline: (deadlineMs: number) => InterruptHandler;
	outputs: Array<string>;
	runtime: QuickJSRuntime;
}): SiteScriptOutputs | null => {
	runtime.setInterruptHandler(deadline(Date.now() + CALL_DEADLINE_MS));
	const evaluated = context.evalCode(code, "site-script-call.js", { strict: true });

	if (evaluated.error) {
		evaluated.error.dispose();

		return null;
	}

	const dumped: unknown = context.dump(evaluated.value);
	evaluated.value.dispose();

	try {
		return parseOutputs({ dumped, outputs });
	} catch {
		return null;
	}
};

const callInteraction = ({
	context,
	deadline,
	event,
	runtime,
	targets,
}: {
	context: QuickJSContext;
	deadline: (deadlineMs: number) => InterruptHandler;
	event: string;
	runtime: QuickJSRuntime;
	targets: Record<string, string>;
}): SiteScriptCommand | null => {
	runtime.setInterruptHandler(deadline(Date.now() + CALL_DEADLINE_MS));

	const evaluated = context.evalCode(
		`JSON.stringify(interact(${JSON.stringify(event)}));`,
		"site-script-interaction.js",
		{ strict: true }
	);

	if (evaluated.error) {
		evaluated.error.dispose();

		return null;
	}

	const dumped: unknown = context.dump(evaluated.value);
	evaluated.value.dispose();

	try {
		const command = interactionCommandSchema.parse(JSON.parse(stringSchema.parse(dumped)));
		const expectedAnchor = targets[event];

		return expectedAnchor && command.anchor !== expectedAnchor ? null : command;
	} catch {
		return null;
	}
};

export const createSiteScriptSession = async ({
	outputs,
	script,
	signal,
	targets = {},
}: {
	outputs: Array<string>;
	script: string;
	signal?: AbortSignal;
	targets?: Record<string, string>;
}): Promise<SiteScriptSession | null> => {
	try {
		quickJsModuleReference.value ??= import("quickjs-emscripten");
		const { DefaultIntrinsics, getQuickJS, shouldInterruptAfterDeadline } = await quickJsModuleReference.value;
		const quickJs = await getQuickJS();

		if (signal?.aborted) {
			return null;
		}

		const runtime = quickJs.newRuntime();
		runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
		runtime.setMaxStackSize(STACK_LIMIT_BYTES);
		runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + LOAD_DEADLINE_MS));

		if (signal?.aborted) {
			runtime.dispose();

			return null;
		}

		const context = runtime.newContext({
			intrinsics: { ...DefaultIntrinsics, Date: false, Proxy: false },
		});

		const loaded = context.evalCode(`${prelude}\n${script}`, "site-script.js", { strict: true });

		if (loaded.error) {
			loaded.error.dispose();
			context.dispose();
			runtime.dispose();

			return null;
		}

		loaded.value.dispose();

		if (signal?.aborted) {
			context.dispose();
			runtime.dispose();

			return null;
		}

		const disposedReference = { value: false };

		return {
			dispose: () => {
				if (disposedReference.value) {
					return;
				}

				disposedReference.value = true;
				context.dispose();
				runtime.dispose();
			},
			evaluate: ({ inputs }) => {
				if (disposedReference.value) {
					return null;
				}

				const numericInputs = Object.fromEntries(
					Object.entries(inputs).map(([key, value]) => [key, Number(value)])
				);

				if (Object.values(numericInputs).some((value) => !Number.isFinite(value))) {
					return null;
				}

				return callScript({
					code: `JSON.stringify(calculate(${JSON.stringify(numericInputs)}));`,
					context,
					deadline: shouldInterruptAfterDeadline,
					outputs,
					runtime,
				});
			},
			interact: ({ event }) =>
				disposedReference.value
					? null
					: callInteraction({ context, deadline: shouldInterruptAfterDeadline, event, runtime, targets }),
		} satisfies SiteScriptSession;
	} catch {
		return null;
	}
};

export const evaluateSiteScriptInteraction = async ({
	event,
	script,
}: {
	event: string;
	script: string;
}): Promise<SiteScriptCommand | null> => {
	const session = await createSiteScriptSession({ outputs: ["result"], script });

	if (!session) {
		return null;
	}

	try {
		return session.interact({ event });
	} finally {
		session.dispose();
	}
};

export const evaluateSiteScript = async ({
	inputs,
	outputs = ["result"],
	script,
}: {
	inputs: Record<string, string>;
	outputs?: Array<string>;
	script: string;
}): Promise<SiteScriptOutputs | null> => {
	const session = await createSiteScriptSession({ outputs, script });

	if (!session) {
		return null;
	}

	try {
		return session.evaluate({ inputs });
	} finally {
		session.dispose();
	}
};

export const siteScriptProgramInputs = ({
	program,
	slots,
}: {
	program: SiteScriptProgramV1;
	slots: Record<string, string>;
}) => Object.fromEntries(program.slots.map((slot) => [slot.key, slots[slot.key] ?? slot.initial]));
