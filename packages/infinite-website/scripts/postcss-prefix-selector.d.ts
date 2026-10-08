declare module "postcss-prefix-selector" {
	import type { Plugin } from "postcss";

	type PrefixSelectorOptions = {
		prefix: string;
		exclude?: (string | RegExp)[];
		ignoreFiles?: (string | RegExp)[];
		includeFiles?: (string | RegExp)[];
		transform?: (prefix: string, selector: string, prefixedSelector: string, file?: string) => string;
	};

	const prefixSelector: (options: PrefixSelectorOptions) => Plugin;

	export default prefixSelector;
}
