import { RuleTester } from "oxlint/plugins-dev";
import { describe, expect, it } from "vitest";

import { noCommentsRule } from "../rules/no-comments.ts";
import { noCssModulesRule } from "../rules/no-css-modules.ts";
import { noExplicitFunctionReturnTypeRule } from "../rules/no-explicit-function-return-type.ts";
import { noLetRule } from "../rules/no-let.ts";
import { findTautologicalAbsenceMatches } from "../shared/tautological-absence.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
	languageOptions: {
		parserOptions: { lang: "ts" },
		sourceType: "module",
	},
});

tester.run("anti-slop/no-comments", noCommentsRule, {
	invalid: [{ code: "// explanation\nconst value = 1;", errors: [/Remove this comment/] }],
	valid: [
		"// @ts-expect-error\nconst value = 1;",
		"/**\n * @vitest-environment node\n */\nconst value = 1;",
		"/* evlog-map-disable audit */\nconst value = 1;",
		"// oxlint-disable-next-line no-console\nconsole.log('value');",
		{ code: "// generated documentation", filename: "schema.generated.ts" },
	],
});

tester.run("anti-slop/no-css-modules", noCssModulesRule, {
	invalid: [
		{ code: "import styles from './styles.module.css';", errors: [/CSS Modules are not allowed/] },
		{ code: "export * from './styles.module.scss';", errors: [/CSS Modules are not allowed/] },
		{ code: "import('./styles.module.less');", errors: [/CSS Modules are not allowed/] },
		{ code: "require('./styles.module.sass');", errors: [/CSS Modules are not allowed/] },
	],
	valid: ["import './styles.css';", "import styles from './styles.ts';"],
});

tester.run("anti-slop/no-explicit-function-return-type", noExplicitFunctionReturnTypeRule, {
	invalid: [
		{ code: "function value(): number { return 1; }", errors: [/infer it/] },
		{ code: "const value = (): number => 1;", errors: [/infer it/] },
		{ code: "const object = { value(): number { return 1; } };", errors: [/infer it/] },
	],
	valid: [
		"function value() { return 1; }",
		"const value = () => 1;",
		"const object = { value() { return 1; } };",
		"const isString = (value: unknown): value is string => typeof value === 'string';",
	],
});

tester.run("anti-slop/no-let", noLetRule, {
	invalid: [{ code: "let value = 1;", errors: [/Do not use let/] }],
	valid: ["const value = 1;", "var legacyValue = 1;"],
});

describe("tautological absence", () => {
	it("flags vanished instructional copy but preserves state and template checks", () => {
		expect(findTautologicalAbsenceMatches({
			content: "expect(html).not.toContain('The vanished owner subtitle belongs here.')",
			otherContents: [],
			relativePath: "packages/ui/tests/example.test.ts",
		})).toEqual([expect.objectContaining({ needle: "The vanished owner subtitle belongs here." })]);
		expect(findTautologicalAbsenceMatches({
			content: "expect(owner).toContain('Connect your agent')\nexpect(guest).not.toContain('Connect your agent')",
			otherContents: [],
			relativePath: "packages/ui/tests/example.test.ts",
		})).toEqual([]);
		expect(findTautologicalAbsenceMatches({
			content: "expect(html).not.toContain('Connect your agent')",
			otherContents: ["export const title = 'Connect your agent'"],
			relativePath: "packages/ui/tests/example.test.ts",
		})).toEqual([]);
	});
});
