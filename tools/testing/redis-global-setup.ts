import { RedisContainer, type StartedRedisContainer } from "@testcontainers/redis";
import { GenericContainer, Network, type StartedNetwork, type StartedTestContainer } from "testcontainers";

type MutableReference<Value> = { value: Value };

const redisContainerReference: MutableReference<StartedRedisContainer | undefined> = { value: undefined };

const proxyContainerReference: MutableReference<StartedTestContainer | undefined> = { value: undefined };

const networkReference: MutableReference<StartedNetwork | undefined> = { value: undefined };

const cleanup = async (task: () => Promise<void>) => {
	try {
		await task();
	} catch (error) {
		console.error(error);
	}
};

export const setup = async () => {
	networkReference.value = await new Network().start();

	try {
		redisContainerReference.value = await new RedisContainer(
			"redis@sha256:f03dda4477b065b161ac3338645710405c5c9fbecb1c983af495b1b1d444bcd1"
		)
			.withNetwork(networkReference.value)
			.withNetworkAliases("redis")
			.start();

		proxyContainerReference.value = await new GenericContainer(
			"hiett/serverless-redis-http@sha256:5b0bb9239fce53abf87b2018a7a0deb9ec7bd900c5360738fe5fbeeb426f9150"
		)
			.withExposedPorts(80)
			.withNetwork(networkReference.value)
			.withEnvironment({
				SRH_CONNECTION_STRING: "redis://redis:6379",
				SRH_MODE: "env",
				SRH_TOKEN: "test-token",
			})
			.start();

		process.env.REDIS_URL = redisContainerReference.value.getConnectionUrl();
		process.env.UPSTASH_URL = `http://${proxyContainerReference.value.getHost()}:${proxyContainerReference.value.getMappedPort(80)}`;
		process.env.UPSTASH_TOKEN = "test-token";
	} catch (error) {
		if (proxyContainerReference.value) {
			await cleanup(async () => {
				await proxyContainerReference.value.stop();
			});
		}

		if (redisContainerReference.value) {
			await cleanup(async () => {
				await redisContainerReference.value.stop();
			});
		}

		await cleanup(async () => {
			await networkReference.value.stop();
		});
		throw error;
	}
};

export const teardown = async () => {
	await proxyContainerReference.value?.stop();
	await redisContainerReference.value?.stop();
	await networkReference.value?.stop();
};
