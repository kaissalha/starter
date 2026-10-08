import { readFile } from "node:fs/promises";
import path from "node:path";
import postcss, { type Rule } from "postcss";
import { describe, expect, it } from "vitest";

import { compileWebsiteStyles } from "../scripts/compile-styles";
import { SCOPE } from "../scripts/postcss-scope";

const packageRoot = path.resolve(import.meta.dirname, "..");

const inputPath = path.join(packageRoot, "styles", "input.css");

const hostVisibilityToggles = new Set([`${SCOPE} .invisible`, `${SCOPE} .opacity-0`]);

const isInsideKeyframes = (rule: Rule) => rule.parent?.type === "atrule" && rule.parent.name.endsWith("keyframes");

const isScopedSelector = (selector: string) =>
	selector === SCOPE ||
	selector.startsWith(`${SCOPE} `) ||
	selector.startsWith(`${SCOPE}:`) ||
	selector.startsWith(`${SCOPE}[`);

describe("compiled website stylesheet", () => {
	it("compiles the production artifact without leaking selectors into its host", async () => {
		const input = await readFile(inputPath, "utf8");

		const css = await compileWebsiteStyles({
			from: inputPath,
			input,
			optimize: true,
			to: path.join(packageRoot, "dist", "styles.css"),
		});

		const root = postcss.parse(css);
		const leaked: Array<string> = [];
		const duplicated: Array<string> = [];
		const overridden: Array<string> = [];

		root.walkRules((rule) => {
			if (isInsideKeyframes(rule)) {
				return;
			}

			const unique = new Set(rule.selectors);

			if (unique.size !== rule.selectors.length) {
				duplicated.push(rule.selector);
			}

			rule.selectors.forEach((selector) => {
				if (!isScopedSelector(selector)) {
					leaked.push(selector);
				}

				if (hostVisibilityToggles.has(selector)) {
					overridden.push(selector);
				}
			});
		});

		expect(css.length).toBeGreaterThan(50_000);
		expect(css).not.toContain("@font-face");
		expect(css).toContain("@container website-container");
		expect(css).toContain(`${SCOPE} .iw-layout`);
		expect(css).toContain(`${SCOPE} .iw-layout:dir(rtl)`);
		expect(leaked).toEqual([]);
		expect(duplicated).toEqual([]);
		expect(overridden).toEqual([]);
	});
});
