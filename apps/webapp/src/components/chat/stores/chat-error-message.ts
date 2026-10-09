import { z } from "zod";

const serverErrorSchema = z.compile(z.object({ error: z.object({ message: z.string() }) }));

const knownErrors = [
	["Assistant continuation does not match", "continuationMismatch"],
	["Resolve the pending assistant request", "continuationMismatch"],
	["This approval is no longer pending", "approvalExpired"],
] as const;

export type ChatErrorKey = "approvalExpired" | "continuationMismatch" | "generic";

const extractMessage = (rawMessage: string) => {
	if (!rawMessage.trimStart().startsWith("{")) {
		return rawMessage;
	}

	try {
		// oxlint-disable-next-line unicorn(prefer-structured-clone)
		return serverErrorSchema.safeParse(JSON.parse(rawMessage)).data?.error.message;
	} catch {
		return undefined;
	}
};

export const classifyChatError = (rawMessage: string): { key: ChatErrorKey } | { message: string } => {
	const message = extractMessage(rawMessage);
	const known = knownErrors.find(([prefix]) => message?.startsWith(prefix));

	if (known) {
		return { key: known[1] };
	}

	return message ? { message } : { key: "generic" };
};
