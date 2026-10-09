import { createLock, createRedisClient } from "@starter/cache";

type RedisClientReference = { value?: ReturnType<typeof createRedisClient> };

const redisClientReference: RedisClientReference = {};

export const getChatRedisClient = () => {
	const redisUrl = process.env.REDIS_URL;

	if (!redisUrl) {
		throw new Error("REDIS_URL is not set");
	}

	redisClientReference.value ??= createRedisClient(redisUrl);

	return redisClientReference.value;
};

type ChatScope = { chatId: string; organizationId: string };

const activeStreamKey = ({ chatId, organizationId }: ChatScope) => `chat-stream:${organizationId}:${chatId}`;

export const setActiveChatStream = async ({ streamId, ...chat }: ChatScope & { streamId: string }) => {
	await getChatRedisClient().set(activeStreamKey(chat), streamId, "EX", 86_400);
};

export const getActiveChatStream = (chat: ChatScope) => getChatRedisClient().get(activeStreamKey(chat));

export const clearActiveChatStream = ({ streamId, ...chat }: ChatScope & { streamId: string }) =>
	createLock({ id: activeStreamKey(chat), lease: "1 d", redis: getChatRedisClient(), token: streamId }).release();

export const cancelChatStream = async (chat: ChatScope) => {
	if (process.env.REDIS_URL) {
		await getChatRedisClient().del(activeStreamKey(chat));
	}
};
