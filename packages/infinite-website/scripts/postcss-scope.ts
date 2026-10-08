import type { AcceptedPlugin } from "postcss";
import prefixSelector from "postcss-prefix-selector";

export const SCOPE = ".website-container";

const ROOT_SELECTORS = new Set([":root", ":host", "html", "body"]);

const transformScopedSelector = (prefix: string, selector: string, prefixedSelector: string) => {
	if (ROOT_SELECTORS.has(selector)) {
		return prefix;
	}

	if (selector === prefix || selector.startsWith(`${prefix} `)) {
		return selector;
	}

	return prefixedSelector;
};

const dedupeSelectors: AcceptedPlugin = {
	postcssPlugin: "dedupe-selectors",
	Rule(rule) {
		const unique = [...new Set(rule.selectors)];

		if (unique.length !== rule.selectors.length) {
			rule.selectors = unique;
		}
	},
};

export const scopePlugins: Array<AcceptedPlugin> = [
	prefixSelector({
		prefix: SCOPE,
		transform: transformScopedSelector,
	}),
	dedupeSelectors,
];
