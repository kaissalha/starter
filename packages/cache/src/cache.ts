import type { Redis } from "ioredis";
import type { z } from "zod";

type SetOptions = { ex?: number };

export const createCache = <Schema extends z.ZodType>({
	ex,
	prefix,
	redis,
	schema,
}: {
	ex?: number;
	prefix: string;
	redis: Pick<Redis, "del" | "get" | "set">;
	schema: Schema;
}) => {
	type Value = z.infer<Schema>;

	const keyFor = (key: string) => `${prefix}:${key}`;

	const get = async (key: string): Promise<Value | undefined> => {
		try {
			const value = await redis.get(keyFor(key));

			return value === null ? undefined : schema.safeParse(JSON.parse(value)).data;
		} catch {
			return undefined;
		}
	};

	const set = async (key: string, value: Value, options: SetOptions = {}) => {
		const seconds = options.ex ?? ex;

		try {
			await (seconds
				? redis.set(keyFor(key), JSON.stringify(value), "EX", seconds)
				: redis.set(keyFor(key), JSON.stringify(value)));
		} catch {
			return;
		}
	};

	const del = async (key: string) => {
		try {
			await redis.del(keyFor(key));
		} catch {
			return;
		}
	};

	const getOrSet = async (key: string, load: () => Promise<Value>, options?: SetOptions) => {
		const cached = await get(key);

		if (cached !== undefined) {
			return cached;
		}

		const value = await load();
		await set(key, value, options);

		return value;
	};

	return { del, get, getOrSet, set };
};
