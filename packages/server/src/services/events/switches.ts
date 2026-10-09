import { getRedis } from "../../lib/redis";

const readSwitches = async (keys: Array<string>) => {
	const redis = getRedis();

	if (!redis) {
		return [];
	}

	try {
		return await redis.mget(keys);
	} catch {
		return [];
	}
};

export const isEventConsumerPaused = async ({ consumerKey }: { consumerKey: string }) => {
	const [kind] = consumerKey.split(":");
	const values = await readSwitches([`starter:events:paused:${kind}`, `starter:events:paused:${consumerKey}`]);

	return values.includes("1");
};
