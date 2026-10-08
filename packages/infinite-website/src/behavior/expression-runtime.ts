import Decimal from "decimal.js";

import type { SiteExpressionIrV1, SiteExpressionProgram, SiteExpressionProgramV1 } from "./contracts";

const SiteDecimal = Decimal.clone({ precision: 34, rounding: Decimal.ROUND_HALF_EVEN, toExpNeg: -40, toExpPos: 40 });

type Scalar = { type: "boolean"; value: boolean } | { type: "decimal"; value: Decimal };

const decimal = (scalar: Scalar) => {
	if (scalar.type !== "decimal") {
		throw new Error("Expected decimal");
	}

	return scalar.value;
};

const boolean = (scalar: Scalar) => {
	if (scalar.type !== "boolean") {
		throw new Error("Expected boolean");
	}

	return scalar.value;
};

const evaluateCall = (
	expression: Extract<SiteExpressionIrV1, { type: "call" }>,
	slots: Record<string, string>
): Scalar => {
	const values = expression.arguments.map((argument) => decimal(evaluate(argument, slots)));
	const first = values[0];

	if (!first) {
		throw new Error("Missing argument");
	}

	if (expression.function === "abs") {
		return { type: "decimal" as const, value: first.abs() };
	}

	if (expression.function === "ceil") {
		return { type: "decimal" as const, value: first.ceil() };
	}

	if (expression.function === "floor") {
		return { type: "decimal" as const, value: first.floor() };
	}

	if (expression.function === "min" || expression.function === "max") {
		const second = values[1];

		if (!second) {
			throw new Error("Missing argument");
		}

		return {
			type: "decimal" as const,
			value: expression.function === "min" ? SiteDecimal.min(first, second) : SiteDecimal.max(first, second),
		};
	}

	if (expression.function === "clamp") {
		const minimum = values[1];
		const maximum = values[2];

		if (!minimum || !maximum || minimum.gt(maximum)) {
			throw new Error("Invalid clamp");
		}

		return { type: "decimal" as const, value: SiteDecimal.min(SiteDecimal.max(first, minimum), maximum) };
	}

	const places = values[1] ?? new SiteDecimal(0);

	if (!places.isInteger() || places.isNegative() || places.gt(8)) {
		throw new Error("Invalid precision");
	}

	return { type: "decimal" as const, value: first.toDecimalPlaces(places.toNumber(), Decimal.ROUND_HALF_EVEN) };
};

const evaluateBinary = (
	expression: Extract<SiteExpressionIrV1, { type: "binary" }>,
	slots: Record<string, string>
): Scalar => {
	const lhs = evaluate(expression.lhs, slots);

	if (expression.operator === "&&") {
		return { type: "boolean" as const, value: boolean(lhs) && boolean(evaluate(expression.rhs, slots)) };
	}

	if (expression.operator === "||") {
		return { type: "boolean" as const, value: boolean(lhs) || boolean(evaluate(expression.rhs, slots)) };
	}

	const rhs = evaluate(expression.rhs, slots);

	if (expression.operator === "==" || expression.operator === "!=") {
		const equal =
			lhs.type === "boolean"
				? rhs.type === "boolean" && lhs.value === rhs.value
				: rhs.type === "decimal" && lhs.value.eq(rhs.value);

		return { type: "boolean" as const, value: expression.operator === "==" ? equal : !equal };
	}

	const leftValue = decimal(lhs);
	const rightValue = decimal(rhs);

	if (expression.operator === "+") {
		return { type: "decimal" as const, value: leftValue.add(rightValue) };
	}

	if (expression.operator === "-") {
		return { type: "decimal" as const, value: leftValue.sub(rightValue) };
	}

	if (expression.operator === "*") {
		return { type: "decimal" as const, value: leftValue.mul(rightValue) };
	}

	if (expression.operator === "<") {
		return { type: "boolean" as const, value: leftValue.lt(rightValue) };
	}

	if (expression.operator === "<=") {
		return { type: "boolean" as const, value: leftValue.lte(rightValue) };
	}

	if (expression.operator === ">") {
		return { type: "boolean" as const, value: leftValue.gt(rightValue) };
	}

	if (expression.operator === ">=") {
		return { type: "boolean" as const, value: leftValue.gte(rightValue) };
	}

	if (rightValue.isZero()) {
		throw new Error("Division by zero");
	}

	return {
		type: "decimal" as const,
		value: expression.operator === "%" ? leftValue.mod(rightValue) : leftValue.div(rightValue),
	};
};

const evaluate = (expression: SiteExpressionIrV1, slots: Record<string, string>): Scalar => {
	if (expression.type === "boolean") {
		return expression;
	}

	if (expression.type === "decimal") {
		return { type: "decimal" as const, value: new SiteDecimal(expression.value) };
	}

	if (expression.type === "reference") {
		const value = slots[expression.key];

		if (!value) {
			throw new Error("Missing slot");
		}

		return { type: "decimal" as const, value: new SiteDecimal(value) };
	}

	if (expression.type === "unary") {
		const value = evaluate(expression.operand, slots);

		return expression.operator === "!"
			? { type: "boolean" as const, value: !boolean(value) }
			: { type: "decimal" as const, value: decimal(value).neg() };
	}

	if (expression.type === "conditional") {
		// oxlint-disable-next-line github/no-then -- `then` is a conditional-expression branch, not a Promise method.
		return evaluate(boolean(evaluate(expression.condition, slots)) ? expression.then : expression.otherwise, slots);
	}

	if (expression.type === "call") {
		return evaluateCall(expression, slots);
	}

	return evaluateBinary(expression, slots);
};

export const evaluateSiteBehavior = ({
	program,
	slots,
}: {
	program: SiteExpressionProgramV1;
	slots: Record<string, string>;
}) => {
	try {
		const result = evaluate(program.result, slots);

		return result.type === "decimal" ? result.value.toString() : null;
	} catch {
		return null;
	}
};

export type SiteBehaviorOutputValue = boolean | string;

const outputValue = (scalar: Scalar): SiteBehaviorOutputValue =>
	scalar.type === "decimal" ? scalar.value.toString() : scalar.value;

export const evaluateSiteBehaviorOutputs = ({
	program,
	slots,
}: {
	program: SiteExpressionProgram;
	slots: Record<string, string>;
}): Record<string, SiteBehaviorOutputValue> | null => {
	if (program.expressionProfile === "site-expression-v1") {
		const result = evaluateSiteBehavior({ program, slots });

		return result === null ? null : { result };
	}

	return Object.fromEntries(
		Object.entries(program.outputs).flatMap(([key, output]) => {
			try {
				return [[key, outputValue(evaluate(output.result, slots))]];
			} catch {
				return [];
			}
		})
	);
};

export const scalePercentagePoints = (value: string) => new SiteDecimal(value).dividedBy(100).toString();
