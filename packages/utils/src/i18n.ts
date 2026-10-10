export type NestedMessages = {
	[key: string]: NestedMessages | string;
};

type Join<K, P> = K extends string | number
	? P extends string | number
		? `${K}${P extends "" ? "" : "."}${P}`
		: never
	: never;

type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ...Array<0>];

type Paths<T, D extends number = 10> = [D] extends [never]
	? never
	: T extends object
		? {
				[K in keyof T]-?: K extends string | number ? `${K}` | Join<K, Paths<T[K], Prev[D]>> : never;
			}[keyof T]
		: "";

export type MessageKey<T> = Paths<T>;

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

export const translateMessages = ({
	fallback,
	messages,
	params,
}: {
	fallback: NestedMessages;
	messages: NestedMessages;
	params?: Record<string, null | number | string | undefined>;
}) => {
	const localized = flattenMessages({ messages });

	return Object.fromEntries(
		Object.entries(flattenMessages({ messages: fallback })).flatMap(([key, englishMessage]) => {
			const message = localized[key] || englishMessage;

			return message ? [[key, interpolateMessage({ message, params })]] : [];
		})
	);
};
