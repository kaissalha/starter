import { randomUUID } from "node:crypto";

import { createTCPRedisClient } from "@starter/cache";

type RedisClient = ReturnType<typeof createTCPRedisClient>;

type RedisClientReference = { value?: RedisClient };

const redisClientReference: RedisClientReference = {};

const STREAM_TTL_SECONDS = 86_400;

const ORGANIZATION_SHUTDOWN_TTL_SECONDS = 60;

export type OrganizationAIShutdownLease = {
	organizationId: string;
	token: string;
};

const getRedisClient = () => {
	if (redisClientReference.value) {
		return redisClientReference.value;
	}

	const redisUrl = process.env.REDIS_URL;

	if (!redisUrl) {
		throw new Error("REDIS_URL is not set");
	}

	redisClientReference.value = createTCPRedisClient(redisUrl);

	return redisClientReference.value;
};

const activeStreamKey = ({ chatId, organizationId }: { chatId: string; organizationId: string }) =>
	`chat-stream-active:${organizationId}:${chatId}`;

const resumableStreamKey = ({ chatId, organizationId }: { chatId: string; organizationId: string }) =>
	`chat-stream-resumable:${organizationId}:${chatId}`;

const organizationActiveStreamsKey = ({ organizationId }: { organizationId: string }) =>
	`chat-stream-executions:${organizationId}`;

const organizationShutdownKey = ({ organizationId }: { organizationId: string }) =>
	`chat-stream-shutdown:${organizationId}`;

const activeStreamMember = ({ chatId, streamId }: { chatId: string; streamId: string }) =>
	JSON.stringify([chatId, streamId]);

const continuationKey = ({
	chatId,
	continuationId,
	messageId,
	organizationId,
}: {
	chatId: string;
	continuationId: string;
	messageId: string;
	organizationId: string;
}) => `chat-continuation:${organizationId}:${chatId}:${messageId}:${continuationId}`;

const messageKey = ({ messageId }: { messageId: string }) => `chat-message:${messageId}`;

const pruneExpiredChatExecutionsScript = `local function prune(executions, prefix)
 for _, member in ipairs(redis.call('smembers', executions)) do
  local execution = cjson.decode(member)
  if redis.call('get', prefix .. execution[1]) ~= execution[2] then redis.call('srem', executions, member) end
 end
end`;

export const consumeChatRequestBudget = async ({
	organizationId,
	userId,
}: {
	organizationId: string;
	userId: string;
}) => {
	const result = await getRedisClient().eval(
		`${pruneExpiredChatExecutionsScript}
 prune(KEYS[3], ARGV[1])
 if redis.call('scard', KEYS[3]) >= 6 then return 0 end
 local user = redis.call('incr', KEYS[1])
 if user == 1 then redis.call('expire', KEYS[1], 60) end
 local organization = redis.call('incr', KEYS[2])
 if organization == 1 then redis.call('expire', KEYS[2], 3600) end
 if user > 30 or organization > 600 then return 0 end
 return 1`,
		3,
		`chat-request-user:${organizationId}:${userId}`,
		`chat-request-organization:${organizationId}`,
		organizationActiveStreamsKey({ organizationId }),
		`chat-stream-active:${organizationId}:`
	);

	return Number(result) === 1;
};

export class ChatCapacityError extends Error {
	constructor() {
		super("The organization has reached its concurrent chat limit. Try again shortly.");
		this.name = "ChatCapacityError";
	}
}

export const setChatStreamId = async ({
	chatId,
	organizationId,
	streamId,
}: {
	chatId: string;
	organizationId: string;
	streamId: string;
}) => {
	const registered = await getRedisClient().eval(
		`${pruneExpiredChatExecutionsScript}
        if redis.call('exists', KEYS[1]) == 1 then return 0 end
        prune(KEYS[4], ARGV[4])
        if redis.call('scard', KEYS[4]) >= 6 then return -1 end
		redis.call('set', KEYS[2], ARGV[1], 'EX', 600)
		redis.call('set', KEYS[3], ARGV[1], 'EX', ARGV[3])
		redis.call('sadd', KEYS[4], ARGV[2])
		redis.call('expire', KEYS[4], ARGV[3])
		return 1`,
		4,
		organizationShutdownKey({ organizationId }),
		activeStreamKey({ chatId, organizationId }),
		resumableStreamKey({ chatId, organizationId }),
		organizationActiveStreamsKey({ organizationId }),
		streamId,
		activeStreamMember({ chatId, streamId }),
		STREAM_TTL_SECONDS,
		`chat-stream-active:${organizationId}:`
	);

	if (Number(registered) === -1) {
		throw new ChatCapacityError();
	}

	return Number(registered) === 1;
};

export const getActiveChatStreamId = ({ chatId, organizationId }: { chatId: string; organizationId: string }) =>
	getRedisClient().get(activeStreamKey({ chatId, organizationId }));

export const getResumableChatStreamId = ({ chatId, organizationId }: { chatId: string; organizationId: string }) =>
	getRedisClient().get(resumableStreamKey({ chatId, organizationId }));

const clearOwnedStreamId = async ({ key, streamId }: { key: string; streamId: string }) => {
	await getRedisClient().eval(
		"if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
		1,
		key,
		streamId
	);
};

export const clearActiveChatStreamId = ({
	chatId,
	organizationId,
	streamId,
}: {
	chatId: string;
	organizationId: string;
	streamId: string;
}) =>
	getRedisClient().eval(
		`local deleted = 0
		if redis.call('get', KEYS[1]) == ARGV[1] then deleted = redis.call('del', KEYS[1]) end
		redis.call('srem', KEYS[2], ARGV[2])
		if redis.call('scard', KEYS[2]) == 0 then redis.call('del', KEYS[2]) end
		return deleted`,
		2,
		activeStreamKey({ chatId, organizationId }),
		organizationActiveStreamsKey({ organizationId }),
		streamId,
		activeStreamMember({ chatId, streamId })
	);

export const clearResumableChatStreamId = ({
	chatId,
	organizationId,
	streamId,
}: {
	chatId: string;
	organizationId: string;
	streamId: string;
}) => clearOwnedStreamId({ key: resumableStreamKey({ chatId, organizationId }), streamId });

export const cancelStream = async ({ chatId, organizationId }: { chatId: string; organizationId: string }) => {
	await getRedisClient().del(
		activeStreamKey({ chatId, organizationId }),
		resumableStreamKey({ chatId, organizationId })
	);
};

export const beginOrganizationAIShutdown = async ({ organizationId }: { organizationId: string }) => {
	const lease = { organizationId, token: randomUUID() };

	const acquired = await getRedisClient().set(
		organizationShutdownKey({ organizationId }),
		lease.token,
		"EX",
		ORGANIZATION_SHUTDOWN_TTL_SECONDS,
		"NX"
	);

	if (acquired !== "OK") {
		throw new Error("Organization AI shutdown is already in progress");
	}

	return lease;
};

export const renewOrganizationAIShutdown = async ({
	lease,
	ttlSeconds = ORGANIZATION_SHUTDOWN_TTL_SECONDS,
}: {
	lease: OrganizationAIShutdownLease;
	ttlSeconds?: number;
}) => {
	const renewed = await getRedisClient().eval(
		"if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('expire', KEYS[1], ARGV[2]) else return 0 end",
		1,
		organizationShutdownKey(lease),
		lease.token,
		ttlSeconds
	);

	return Number(renewed) === 1;
};

export const clearOrganizationAIShutdown = ({ lease }: { lease: OrganizationAIShutdownLease }) =>
	getRedisClient().eval(
		"if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
		1,
		organizationShutdownKey(lease),
		lease.token
	);

export const getOrganizationActiveStreamCount = ({ organizationId }: { organizationId: string }) =>
	getRedisClient().scard(organizationActiveStreamsKey({ organizationId }));

export const claimChatContinuation = async ({
	chatId,
	claimId,
	continuationId,
	messageId,
	organizationId,
}: {
	chatId: string;
	claimId: string;
	continuationId: string;
	messageId: string;
	organizationId: string;
}) =>
	(await getRedisClient().set(
		continuationKey({ chatId, continuationId, messageId, organizationId }),
		claimId,
		"EX",
		604_800,
		"NX"
	)) === "OK";

export const releaseChatContinuation = async ({
	chatId,
	claimId,
	continuationId,
	messageId,
	organizationId,
}: {
	chatId: string;
	claimId: string;
	continuationId: string;
	messageId: string;
	organizationId: string;
}) => {
	await getRedisClient().eval(
		"if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
		1,
		continuationKey({ chatId, continuationId, messageId, organizationId }),
		claimId
	);
};

export const claimChatMessage = async ({ claimId, messageId }: { claimId: string; messageId: string }) =>
	(await getRedisClient().set(messageKey({ messageId }), claimId, "EX", 604_800, "NX")) === "OK";

export const releaseChatMessage = async ({ claimId, messageId }: { claimId: string; messageId: string }) => {
	await getRedisClient().eval(
		"if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
		1,
		messageKey({ messageId }),
		claimId
	);
};
