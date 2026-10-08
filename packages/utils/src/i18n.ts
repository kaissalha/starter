export type NestedMessages = {
	[key: string]: NestedMessages | string;
};

export const flattenMessages = ({
	messages,
	prefix = "",
}: {
	messages: NestedMessages;
	prefix?: string;
}): Record<string, string> =>
	Object.entries(messages).reduce((accumulator: Record<string, string>, [key, value]) => {
		const prefixedKey = prefix ? `${prefix}.${key}` : key;

		if (value instanceof Object) {
			Object.assign(accumulator, flattenMessages({ messages: value, prefix: prefixedKey }));
		} else {
			accumulator[prefixedKey] = value;
		}

		return accumulator;
	}, {});

export const interpolateMessage = ({
	message,
	params,
}: {
	message: string;
	params?: Record<string, null | number | string | undefined>;
}) => {
	if (!params) {
		return message;
	}

	return Object.entries(params).reduce(
		(accumulator, [key, value]) => accumulator.replaceAll(`{${key}}`, String(value ?? "")),
		message
	);
};
