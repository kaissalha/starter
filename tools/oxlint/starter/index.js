const moduleBoundaryStatements = new Set([
	"ExportAllDeclaration",
	"ExportDefaultDeclaration",
	"ExportNamedDeclaration",
	"ImportDeclaration",
	"TSExportAssignment",
	"TSImportEqualsDeclaration",
	"TSNamespaceExportDeclaration",
]);

const isModuleBoundaryStatement = (statement) => {
	return moduleBoundaryStatements.has(statement.type);
};

const isMultilineStatement = (statement) => {
	return statement.loc.start.line !== statement.loc.end.line;
};

const hasUsableRange = (statement) => {
	return Array.isArray(statement.range) && statement.range.length === 2;
};

const hasBlankLineBetween = ({ nextStatement, previousStatement }) => {
	return nextStatement.loc.start.line > previousStatement.loc.end.line + 1;
};

const hasPlainWhitespaceBetween = ({ nextStatement, previousStatement, sourceText }) => {
	const gap = sourceText.slice(previousStatement.range[1], nextStatement.range[0]);

	return gap.trim().length === 0;
};

const shouldSeparateStatements = ({ nextStatement, previousStatement, sourceText }) => {
	if (!hasUsableRange(previousStatement) || !hasUsableRange(nextStatement)) {
		return false;
	}

	if (isModuleBoundaryStatement(previousStatement) || isModuleBoundaryStatement(nextStatement)) {
		return false;
	}

	if (!isMultilineStatement(previousStatement) && !isMultilineStatement(nextStatement)) {
		return false;
	}

	if (hasBlankLineBetween({ nextStatement, previousStatement })) {
		return false;
	}

	return hasPlainWhitespaceBetween({ nextStatement, previousStatement, sourceText });
};

const replacementGap = ({ nextStatement, previousStatement, sourceText }) => {
	const gap = sourceText.slice(previousStatement.range[1], nextStatement.range[0]);
	const newline = gap.includes("\r\n") ? "\r\n" : "\n";
	const lineStart = sourceText.lastIndexOf("\n", nextStatement.range[0] - 1) + 1;
	const indentation = sourceText.slice(lineStart, nextStatement.range[0]);

	return `${newline}${newline}${indentation}`;
};

const checkStatementList = ({ context, sourceText, statements }) => {
	for (const [index, nextStatement] of statements.entries()) {
		const previousStatement = statements[index - 1];

		if (!previousStatement) {
			continue;
		}

		if (!shouldSeparateStatements({ nextStatement, previousStatement, sourceText })) {
			continue;
		}

		context.report({
			fix(fixer) {
				return fixer.replaceTextRange(
					[previousStatement.range[1], nextStatement.range[0]],
					replacementGap({ nextStatement, previousStatement, sourceText })
				);
			},
			loc: nextStatement.loc,
			messageId: "missingBlankLine",
		});
	}
};

const paddingAroundMultilineStatements = {
	create: (context) => {
		const sourceText = context.sourceCode.getText();

		return {
			BlockStatement: (node) => {
				checkStatementList({ context, sourceText, statements: node.body });
			},
			Program: (node) => {
				checkStatementList({ context, sourceText, statements: node.body });
			},
			StaticBlock: (node) => {
				checkStatementList({ context, sourceText, statements: node.body });
			},
			SwitchCase: (node) => {
				checkStatementList({ context, sourceText, statements: node.consequent });
			},
		};
	},
	meta: {
		docs: {
			description:
				"Require blank lines around multiline statements without changing imports, exports, or comments",
		},
		fixable: "whitespace",
		messages: {
			missingBlankLine: "Add a blank line around this multiline statement.",
		},
		schema: [],
		type: "layout",
	},
};

export default {
	meta: { name: "starter" },
	rules: {
		"padding-around-multiline-statements": paddingAroundMultilineStatements,
	},
};
