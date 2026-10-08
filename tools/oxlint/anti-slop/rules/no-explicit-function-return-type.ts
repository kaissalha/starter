import type { RuleTester } from "oxlint/plugins-dev";

type Rule = Parameters<RuleTester["run"]>[1];
type VisitorObject = ReturnType<NonNullable<Rule["create"]>>;
type FunctionDeclarationNode = Parameters<NonNullable<VisitorObject["FunctionDeclaration"]>>[0];
type FunctionExpressionNode = Parameters<NonNullable<VisitorObject["FunctionExpression"]>>[0];
type ArrowFunctionExpressionNode = Parameters<NonNullable<VisitorObject["ArrowFunctionExpression"]>>[0];
type FunctionNode = ArrowFunctionExpressionNode | FunctionDeclarationNode | FunctionExpressionNode;

export const noExplicitFunctionReturnTypeRule: Rule = {
	create(context) {
		const check = (node: FunctionNode) => {
			if (node.returnType === null || node.returnType === undefined) {
				return;
			}
			if (node.returnType.typeAnnotation.type === "TSTypePredicate") {
				return;
			}

			context.report({
				message: "Do not explicitly declare a function return type; infer it.",
				node: node.returnType,
			});
		};

		return {
			ArrowFunctionExpression: check,
			FunctionDeclaration: check,
			FunctionExpression: check,
		};
	},
	meta: {
		docs: {
			description: "Disallow explicit return type annotations on function implementations.",
		},
		type: "problem",
	},
};
