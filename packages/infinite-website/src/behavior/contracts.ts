import { z } from "zod";

import { anchorSchema } from "../document/content-schema";
import { sectionAuthoringResourceLimits } from "../resource-limits";

export const behaviorKeySchema = z.compile(z.string().regex(/^[a-z][a-z0-9_]{0,31}$/u));

export const decimalValuePattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u;

export const decimalValueSchema = z.compile(z.string().regex(decimalValuePattern).max(400));

export const siteBehaviorOutputTypeSchema = z.compile(z.enum(["boolean", "decimal"]));

export type SiteBehaviorOutputType = z.infer<typeof siteBehaviorOutputTypeSchema>;

type ExpressionType = SiteBehaviorOutputType;

type ExpressionMetrics = { depth: number; nodes: number };

export type SiteExpressionIrV1 =
	| { type: "boolean"; value: boolean }
	| { type: "decimal"; value: string }
	| { key: string; type: "reference" }
	| { operand: SiteExpressionIrV1; operator: "!" | "-"; type: "unary" }
	| {
			lhs: SiteExpressionIrV1;
			operator: "!=" | "%" | "&&" | "*" | "+" | "-" | "/" | "<" | "<=" | "==" | ">" | ">=" | "||";
			rhs: SiteExpressionIrV1;
			type: "binary";
	  }
	| { condition: SiteExpressionIrV1; otherwise: SiteExpressionIrV1; then: SiteExpressionIrV1; type: "conditional" }
	| {
			arguments: Array<SiteExpressionIrV1>;
			function: "abs" | "ceil" | "clamp" | "floor" | "max" | "min" | "round";
			type: "call";
	  };

export const siteExpressionIrSchema: z.ZodType<SiteExpressionIrV1> = z.lazy(() =>
	z.discriminatedUnion("type", [
		z.strictObject({ type: z.literal("boolean"), value: z.boolean() }),
		z.strictObject({ type: z.literal("decimal"), value: decimalValueSchema }),
		z.strictObject({ key: behaviorKeySchema, type: z.literal("reference") }),
		z.strictObject({ operand: siteExpressionIrSchema, operator: z.enum(["!", "-"]), type: z.literal("unary") }),
		z.strictObject({
			lhs: siteExpressionIrSchema,
			operator: z.enum(["!=", "%", "&&", "*", "+", "-", "/", "<", "<=", "==", ">", ">=", "||"]),
			rhs: siteExpressionIrSchema,
			type: z.literal("binary"),
		}),
		z.strictObject({
			condition: siteExpressionIrSchema,
			otherwise: siteExpressionIrSchema,
			then: siteExpressionIrSchema,
			type: z.literal("conditional"),
		}),
		z.strictObject({
			arguments: z.array(siteExpressionIrSchema).min(1).max(3),
			function: z.enum(["abs", "ceil", "clamp", "floor", "max", "min", "round"]),
			type: z.literal("call"),
		}),
	])
);

const childrenOf = (expression: SiteExpressionIrV1): Array<SiteExpressionIrV1> => {
	if (expression.type === "unary") {
		return [expression.operand];
	}

	if (expression.type === "binary") {
		return [expression.lhs, expression.rhs];
	}

	if (expression.type === "conditional") {
		// oxlint-disable-next-line github/no-then -- `then` is a conditional-expression branch, not a Promise method.
		return [expression.condition, expression.then, expression.otherwise];
	}

	return expression.type === "call" ? expression.arguments : [];
};

const expressionMetrics = (expression: SiteExpressionIrV1): ExpressionMetrics => {
	const children = childrenOf(expression).map(expressionMetrics);

	return {
		depth: children.length === 0 ? 1 : 1 + Math.max(...children.map((child) => child.depth)),
		nodes: 1 + children.reduce((total, child) => total + child.nodes, 0),
	};
};

const functionArities = {
	abs: new Set([1]),
	ceil: new Set([1]),
	clamp: new Set([3]),
	floor: new Set([1]),
	max: new Set([2]),
	min: new Set([2]),
	round: new Set([1, 2]),
};

const booleanOperators = new Set(["&&", "||"]);

const equalityOperators = new Set(["==", "!="]);

const comparisonOperators = new Set(["<", "<=", ">", ">="]);

const inferBinaryType = ({
	lhs,
	onIssue,
	operator,
	rhs,
}: {
	lhs: ExpressionType | undefined;
	onIssue: (message: string) => void;
	operator: Extract<SiteExpressionIrV1, { type: "binary" }>["operator"];
	rhs: ExpressionType | undefined;
}): ExpressionType => {
	if (booleanOperators.has(operator)) {
		if ((lhs && lhs !== "boolean") || (rhs && rhs !== "boolean")) {
			onIssue("Boolean operators require booleans");
		}

		return "boolean";
	}

	if (equalityOperators.has(operator)) {
		if (lhs && rhs && lhs !== rhs) {
			onIssue("Equality operands must have the same type");
		}

		return "boolean";
	}

	if ((lhs && lhs !== "decimal") || (rhs && rhs !== "decimal")) {
		onIssue("Numeric operators require decimals");
	}

	return comparisonOperators.has(operator) ? "boolean" : "decimal";
};

const validateExpression = ({
	expression,
	onIssue,
	slots,
}: {
	expression: SiteExpressionIrV1;
	onIssue: (message: string) => void;
	slots: Set<string>;
}): ExpressionType | undefined => {
	const infer = (candidate: SiteExpressionIrV1): ExpressionType | undefined => {
		if (candidate.type === "boolean") {
			return "boolean";
		}

		if (candidate.type === "decimal") {
			return "decimal";
		}

		if (candidate.type === "reference") {
			if (!slots.has(candidate.key)) {
				onIssue(`Unknown slot reference "${candidate.key}"`);
			}

			return slots.has(candidate.key) ? "decimal" : undefined;
		}

		if (candidate.type === "unary") {
			const expected = candidate.operator === "!" ? "boolean" : "decimal";
			const operand = infer(candidate.operand);

			if (operand && operand !== expected) {
				onIssue(`Unary ${candidate.operator} requires a ${expected}`);
			}

			return expected;
		}

		if (candidate.type === "conditional") {
			const condition = infer(candidate.condition);
			// oxlint-disable-next-line github/no-then -- `then` is a conditional-expression branch, not a Promise method.
			const thenType = infer(candidate.then);
			const otherwiseType = infer(candidate.otherwise);

			if (condition && condition !== "boolean") {
				onIssue("Conditional condition must be boolean");
			}

			if (thenType && otherwiseType && thenType !== otherwiseType) {
				onIssue("Conditional branches must match");
			}

			return thenType === otherwiseType ? thenType : undefined;
		}

		if (candidate.type === "call") {
			candidate.arguments.forEach((argument) => {
				if (infer(argument) === "boolean") {
					onIssue(`${candidate.function} requires decimal arguments`);
				}
			});

			if (!functionArities[candidate.function].has(candidate.arguments.length)) {
				onIssue(`${candidate.function} received the wrong number of arguments`);
			}

			return "decimal";
		}

		return inferBinaryType({
			lhs: infer(candidate.lhs),
			onIssue,
			operator: candidate.operator,
			rhs: infer(candidate.rhs),
		});
	};

	return infer(expression);
};

export const behaviorSlotsSchema = z
	.array(z.strictObject({ initial: decimalValueSchema, key: behaviorKeySchema }))
	.min(1)
	.max(sectionAuthoringResourceLimits.fields);

export const behaviorExpressionSourceSchema = z.string().trim().min(1).max(512);

export const behaviorScriptSourceSchema = z.string().trim().min(1).max(8000);

const requireUniqueSlotKeys = (
	slots: Array<{ key: string }>,
	addIssue: (issue: { code: "custom"; message: string; path: Array<number | string> }) => void
) => {
	const seen = new Set<string>();

	slots.forEach((slot, index) => {
		if (seen.has(slot.key)) {
			addIssue({ code: "custom", message: `Duplicate slot "${slot.key}"`, path: ["slots", index, "key"] });
		}

		seen.add(slot.key);
	});

	return seen;
};

export const siteBehaviorProgramSchema = z.discriminatedUnion("expressionProfile", [
	z
		.strictObject({
			behaviorVersion: z.literal(1),
			expressionProfile: z.literal("site-expression-v1"),
			result: siteExpressionIrSchema,
			slots: behaviorSlotsSchema,
			source: behaviorExpressionSourceSchema,
		})
		.superRefine((program, context) => {
			const slots = requireUniqueSlotKeys(program.slots, (issue) => context.addIssue(issue));

			const resultType = validateExpression({
				expression: program.result,
				onIssue: (message) => context.addIssue({ code: "custom", message, path: ["result"] }),
				slots,
			});

			const metrics = expressionMetrics(program.result);

			if (resultType && resultType !== "decimal") {
				context.addIssue({ code: "custom", message: "Behavior result must be decimal", path: ["result"] });
			}

			if (metrics.nodes > 64 || metrics.depth > 16) {
				context.addIssue({ code: "custom", message: "Expression exceeds the MVP budget", path: ["result"] });
			}
		}),
	z
		.strictObject({
			behaviorVersion: z.literal(1),
			events: z.record(behaviorKeySchema, anchorSchema).optional(),
			expressionProfile: z.literal("site-expression-v2"),
			outputs: z.record(
				behaviorKeySchema,
				z.strictObject({
					result: siteExpressionIrSchema,
					source: behaviorExpressionSourceSchema,
					type: siteBehaviorOutputTypeSchema,
				})
			),
			slots: behaviorSlotsSchema,
		})
		.superRefine((program, context) => {
			const slots = requireUniqueSlotKeys(program.slots, (issue) => context.addIssue(issue));
			const outputs = Object.entries(program.outputs);
			const events = Object.keys(program.events ?? {});

			if (outputs.length < 1 || outputs.length > sectionAuthoringResourceLimits.outputs) {
				context.addIssue({
					code: "custom",
					message: `Named expressions require between 1 and ${sectionAuthoringResourceLimits.outputs} outputs`,
					path: ["outputs"],
				});
			}

			if (program.events && (events.length < 1 || events.length > sectionAuthoringResourceLimits.events)) {
				context.addIssue({
					code: "custom",
					message: `Named expressions allow between 1 and ${sectionAuthoringResourceLimits.events} events`,
					path: ["events"],
				});
			}

			outputs.forEach(([key, output]) => {
				const resultType = validateExpression({
					expression: output.result,
					onIssue: (message) =>
						context.addIssue({ code: "custom", message, path: ["outputs", key, "result"] }),
					slots,
				});

				const metrics = expressionMetrics(output.result);

				if (resultType && resultType !== output.type) {
					context.addIssue({
						code: "custom",
						message: `Output declares ${output.type} but its expression produces ${resultType}`,
						path: ["outputs", key, "type"],
					});
				}

				if (metrics.nodes > 64 || metrics.depth > 16) {
					context.addIssue({
						code: "custom",
						message: "Expression exceeds the MVP budget",
						path: ["outputs", key, "result"],
					});
				}
			});
		}),
	z
		.strictObject({
			behaviorVersion: z.literal(1),
			events: z.array(behaviorKeySchema).min(1).max(sectionAuthoringResourceLimits.events).optional(),
			expressionProfile: z.literal("custom-js-v1"),
			initialOutputs: z.record(behaviorKeySchema, decimalValueSchema).nullable(),
			outputs: z.array(behaviorKeySchema).min(1).max(sectionAuthoringResourceLimits.outputs),
			script: behaviorScriptSourceSchema,
			slots: behaviorSlotsSchema,
			targets: z.record(behaviorKeySchema, anchorSchema).optional(),
		})
		.superRefine((program, context) => {
			requireUniqueSlotKeys(program.slots, (issue) => context.addIssue(issue));

			if (new Set(program.outputs).size !== program.outputs.length) {
				context.addIssue({ code: "custom", message: "Script outputs must be unique", path: ["outputs"] });
			}

			if (program.events && new Set(program.events).size !== program.events.length) {
				context.addIssue({ code: "custom", message: "Script events must be unique", path: ["events"] });
			}

			if (Boolean(program.events) !== Boolean(program.targets)) {
				context.addIssue({
					code: "custom",
					message: "Interactive scripts require both events and targets",
					path: [program.events ? "targets" : "events"],
				});
			}

			const events = new Set(program.events ?? []);
			const targets = Object.keys(program.targets ?? {});

			if (events.size !== targets.length || targets.some((event) => !events.has(event))) {
				context.addIssue({
					code: "custom",
					message: "Script targets must match its declared events",
					path: ["targets"],
				});
			}

			const initialKeys = Object.keys(program.initialOutputs ?? {});

			if (
				program.initialOutputs !== null &&
				(initialKeys.length !== program.outputs.length ||
					initialKeys.some((key) => !program.outputs.includes(key)))
			) {
				context.addIssue({
					code: "custom",
					message: "initialOutputs must provide exactly the declared outputs",
					path: ["initialOutputs"],
				});
			}
		}),
]);

export type SiteBehaviorProgramV1 = z.infer<typeof siteBehaviorProgramSchema>;

export type SiteExpressionProgramV1 = Extract<SiteBehaviorProgramV1, { expressionProfile: "site-expression-v1" }>;

export type SiteExpressionProgramV2 = Extract<SiteBehaviorProgramV1, { expressionProfile: "site-expression-v2" }>;

export type SiteExpressionProgram = SiteExpressionProgramV1 | SiteExpressionProgramV2;

export type SiteScriptProgramV1 = Extract<SiteBehaviorProgramV1, { expressionProfile: "custom-js-v1" }>;

export const siteBehaviorValueFormatSchema = z.compile(
	z.discriminatedUnion("style", [
		z.strictObject({
			maximumFractionDigits: z.number().int().min(0).max(8).default(2),
			style: z.literal("decimal"),
		}),
		z.strictObject({
			currency: z.string().regex(/^[A-Z]{3}$/u),
			maximumFractionDigits: z.number().int().min(0).max(8).default(2),
			style: z.literal("currency"),
		}),
		z.strictObject({
			maximumFractionDigits: z.number().int().min(0).max(8).default(1),
			style: z.literal("percent"),
			valueScale: z.enum(["ratio", "percentage-points"]),
		}),
	])
);

export type SiteBehaviorValueFormatV1 = z.infer<typeof siteBehaviorValueFormatSchema>;
