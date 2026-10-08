import { parse, type ASTNode } from "@marcbachmann/cel-js";
import { z } from "zod";

import {
	siteBehaviorProgramSchema,
	type SiteBehaviorOutputType,
	type SiteBehaviorProgramV1,
	type SiteExpressionIrV1,
	type SiteExpressionProgramV2,
} from "./contracts";

const functionSchema = z.compile(z.enum(["abs", "ceil", "clamp", "floor", "max", "min", "round"]));

const binaryOperatorSchema = z.compile(z.enum(["+", "-", "*", "/", "%", "==", "!=", "<", "<=", ">", ">=", "&&", "||"]));

const binaryArgumentsSchema = z.compile(z.tuple([z.custom<ASTNode>(), z.custom<ASTNode>()]));

const booleanSchema = z.compile(z.boolean());

const numericSchema = z.compile(z.union([z.number(), z.bigint()]));

const compileNode = ({ node, variables }: { node: ASTNode; variables: Map<string, string> }): SiteExpressionIrV1 => {
	if (node.op === "value") {
		const boolean = booleanSchema.safeParse(node.args);

		if (boolean.success) {
			return { type: "boolean", value: boolean.data };
		}

		if (!numericSchema.safeParse(node.args).success) {
			throw new Error("Only decimal and boolean literals are supported");
		}

		const value = node.input.slice(node.start, node.end);

		if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)) {
			throw new Error(`Unsupported numeric literal "${value}"`);
		}

		return { type: "decimal", value };
	}

	if (node.op === "id") {
		const key = variables.get(node.args);

		if (!key) {
			throw new Error(`Unknown behavior field "${node.args}"`);
		}

		return { key, type: "reference" };
	}

	if (node.op === "!_" || node.op === "-_") {
		return {
			operand: compileNode({ node: node.args, variables }),
			operator: node.op === "!_" ? "!" : "-",
			type: "unary",
		};
	}

	if (node.op === "?:") {
		return {
			condition: compileNode({ node: node.args[0], variables }),
			otherwise: compileNode({ node: node.args[2], variables }),
			then: compileNode({ node: node.args[1], variables }),
			type: "conditional",
		};
	}

	if (node.op === "call") {
		const [name, arguments_] = node.args;
		const supported = functionSchema.safeParse(name);

		if (!supported.success) {
			throw new Error(`Unsupported CEL function "${name}"`);
		}

		return {
			arguments: arguments_.map((argument) => compileNode({ node: argument, variables })),
			function: supported.data,
			type: "call",
		};
	}

	const operator = binaryOperatorSchema.safeParse(node.op);

	if (operator.success) {
		const [lhs, rhs] = binaryArgumentsSchema.parse(node.args);

		return {
			lhs: compileNode({ node: lhs, variables }),
			operator: operator.data,
			rhs: compileNode({ node: rhs, variables }),
			type: "binary",
		};
	}

	throw new Error(`Unsupported CEL construct "${node.op}"`);
};

const compileExpression = ({ source, variables }: { source: string; variables: Map<string, string> }) => {
	const normalizedSource = source.trim();

	const root = (() => {
		try {
			return parse(normalizedSource).ast;
		} catch (error) {
			throw new Error(
				error instanceof Error ? `Invalid CEL expression: ${error.message}` : "Invalid CEL expression",
				{ cause: error }
			);
		}
	})();

	if (!root) {
		throw new Error("Invalid CEL expression");
	}

	return { result: compileNode({ node: root, variables }), source: normalizedSource };
};

export const compileBehaviorProgram = ({
	fields,
	source,
}: {
	fields: Array<{ initial: string; key: string }>;
	source: string;
}): SiteBehaviorProgramV1 => {
	const variables = new Map(fields.map((field) => [field.key, field.key]));
	const compiled = compileExpression({ source, variables });

	return siteBehaviorProgramSchema.parse({
		behaviorVersion: 1,
		expressionProfile: "site-expression-v1",
		result: compiled.result,
		slots: fields.map((field) => ({ initial: field.initial, key: field.key })),
		source: compiled.source,
	});
};

export const compileBehaviorOutputs = ({
	events,
	fields,
	outputs,
}: {
	events?: Record<string, string>;
	fields: Array<{ initial: string; key: string }>;
	outputs: Record<string, { source: string; type: SiteBehaviorOutputType }>;
}): SiteExpressionProgramV2 => {
	const variables = new Map(fields.map((field) => [field.key, field.key]));

	const compiledOutputs = Object.fromEntries(
		Object.entries(outputs).map(([key, output]) => [
			key,
			{ ...compileExpression({ source: output.source, variables }), type: output.type },
		])
	);

	const program = siteBehaviorProgramSchema.parse({
		behaviorVersion: 1,
		events,
		expressionProfile: "site-expression-v2",
		outputs: compiledOutputs,
		slots: fields.map((field) => ({ initial: field.initial, key: field.key })),
	});

	if (program.expressionProfile !== "site-expression-v2") {
		throw new Error("Named expression compilation produced an incompatible program");
	}

	return program;
};
