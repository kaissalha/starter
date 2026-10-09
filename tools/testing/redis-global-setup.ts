import { RedisContainer, type StartedRedisContainer } from "@testcontainers/redis";

type MutableReference<Value> = { value: Value };

const redisContainerReference: MutableReference<StartedRedisContainer | undefined> = { value: undefined };

export const setup = async () => {
	redisContainerReference.value = await new RedisContainer(
		"redis@sha256:f03dda4477b065b161ac3338645710405c5c9fbecb1c983af495b1b1d444bcd1"
	).start();

	process.env.REDIS_URL = redisContainerReference.value.getConnectionUrl();
};

export const teardown = async () => {
	await redisContainerReference.value?.stop();
};
