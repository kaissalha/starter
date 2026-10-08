import type { RuleTester } from "oxlint/plugins-dev";

type Rule = Parameters<RuleTester["run"]>[1];

export const noLetRule: Rule = {
	create(context) {
		return {
			VariableDeclaration(node) {
				if (node.kind !== "let") {
					return;
				}

				context.report({
					message: "Do not use let; express the value without reassignment.",
					node,
				});
			},
		};
	},
	meta: {
		docs: {
			description: "Disallow let declarations.",
		},
		type: "problem",
	},
};
