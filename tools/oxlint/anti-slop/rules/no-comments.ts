import type { RuleTester } from "oxlint/plugins-dev";

type Rule = Parameters<RuleTester["run"]>[1];

const allowedDirective =
	/^(?:\/\s*<reference|@(?:jest|ts|vitest)-|c8 |eslint-|evlog-|istanbul |oxfmt-|oxlint-|SAFETY\s*:)/;

const getCommentValue = (value: string) => value.replaceAll(/^\s*\* ?/gm, "").trim();

export const noCommentsRule: Rule = {
	create(context) {
		const filename = context.filename ?? "";

		if (filename.endsWith(".d.ts") || filename.includes(".generated.")) {
			return {};
		}

		return {
			Program() {
				for (const comment of context.sourceCode.getAllComments()) {
					if (comment.type === "Shebang" || allowedDirective.test(getCommentValue(comment.value))) {
						continue;
					}

					context.report({
						message:
							"Remove this comment. Keep the code self-explanatory; lint and compiler directives remain available for explicit exceptions.",
						node: comment,
					});
				}
			},
		};
	},
	meta: {
		docs: {
			description:
				"Remove source comments and keep code self-explanatory; compiler, coverage, and lint directives remain allowed.",
		},
		type: "problem",
	},
};
