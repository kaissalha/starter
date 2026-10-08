import { readFileSync } from "node:fs";
import path from "node:path";

export const readGatewayKey = () => {
	if (process.env.AI_GATEWAY_API_KEY) {
		return process.env.AI_GATEWAY_API_KEY;
	}

	try {
		const env = readFileSync(path.resolve(import.meta.dirname, "../../../../../apps/webapp/.env.local"), "utf8");

		return /^AI_GATEWAY_API_KEY=["']?([^"'\n]*)/mu.exec(env)?.[1];
	} catch {
		return undefined;
	}
};
