import type { Redis } from "ioredis";

import { type Duration, toMilliseconds } from "./utils/duration";

const extendScript =
	"if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE', KEYS[1], ARGV[2]) else return 0 end";

const releaseScript =
	"if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end";

export const createLock = ({
	id,
	lease,
	redis,
	token = crypto.randomUUID(),
}: {
	id: string;
	lease: Duration;
	redis: Pick<Redis, "eval" | "set">;
	token?: string;
}) => {
	const leaseMilliseconds = toMilliseconds(lease);

	return {
		acquire: async () => (await redis.set(id, token, "PX", leaseMilliseconds, "NX")) === "OK",
		extend: async (duration: Duration = lease) =>
			Number(await redis.eval(extendScript, 1, id, token, toMilliseconds(duration))) === 1,
		id,
		release: async () => Number(await redis.eval(releaseScript, 1, id, token)) === 1,
		token,
	};
};
