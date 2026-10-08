import { Mastra } from "@mastra/core/mastra";
import { MastraStorageExporter, Observability } from "@mastra/observability";

import { dashboardChatAgent } from "../ai/agent";
import { knowledgeVector } from "./knowledge";
import { mastraStorage } from "./memory";

export const mastra = new Mastra({
	agents: { dashboardChatAgent },
	environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
	observability: new Observability({
		configs: {
			default: {
				exporters: [new MastraStorageExporter()],
				requestContextKeys: ["chatId", "organizationId", "userId"],
				serviceName: "starter-ai",
			},
		},
		sensitiveDataFilter: true,
	}),
	storage: mastraStorage,
	vectors: { knowledge: knowledgeVector },
});

export const flushMastraObservability = () => mastra.observability.flush();
