import { register } from "node:module";

register(
	`data:text/javascript,${encodeURIComponent(
		"export const resolve = (specifier, context, next) => next(specifier, specifier.endsWith('.json') ? { ...context, importAttributes: { ...context.importAttributes, type: 'json' } } : context).then((result) => specifier.endsWith('.json') ? { ...result, importAttributes: { type: 'json' } } : result);"
	)}`
);
