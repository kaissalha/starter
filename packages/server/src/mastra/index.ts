import { Mastra } from "@mastra/core/mastra";
import { MastraStorageExporter, Observability } from "@mastra/observability";

import { dashboardChatAgent } from "../ai/agent";
import { decisionClassifiers } from "../ai/decisions";
import { ingestFileWorkflow } from "../workflows/ingest-file";
import { documentClassifierAgent, imageClassifierAgent } from "../workflows/ingest-file/agents";
import { knowledgeVector } from "./knowledge";
import { mastraStorage } from "./memory";

export const mastra = new Mastra({
	agents: { dashboardChatAgent, documentClassifierAgent, imageClassifierAgent },
	classifiers: decisionClassifiers,
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
	workflows: { ingestFileWorkflow },
});

export const flushMastraObservability = () => mastra.observability.flush();
