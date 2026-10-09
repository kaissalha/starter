import { WorkingMemory } from "@mastra/core/processors";
import { Memory } from "@mastra/memory";

import { pool } from "@starter/db";
import { createMastraStore } from "@starter/db/mastra";

import { decisionClassifiers, evaluateDecision } from "../ai/decisions";
import {
	dashboardChatObservationInstructions,
	dashboardChatReflectionInstructions,
	dashboardChatTitleInstructions,
	dashboardObservationGateInstructions,
	organizationWorkingMemoryTemplate,
} from "../ai/prompts";
import { models } from "./models";

export const mastraStorage = createMastraStore({ pool });

export const dashboardChatMemory = new Memory({
	options: {
		generateTitle: { instructions: dashboardChatTitleInstructions, model: models.cheapFast.model },
		observationalMemory: {
			hooks: {
				beforeObservation: async ({ messages }) => {
					const decision = await evaluateDecision({
						classifier: decisionClassifiers.observationGate,
						policy: "background",
						questions: {
							containsDurableFacts: {
								instructions: dashboardObservationGateInstructions,
								type: "boolean",
							},
						},
						state: messages.map(({ content, role }) => ({
							role,
							text: content.parts
								.flatMap((part) => (part.type === "text" ? [part.text] : []))
								.join("\n")
								.slice(0, 2000),
						})),
					});

					return decision && decision.answers.containsDurableFacts.probability < 0.2
						? { messages: [] }
						: undefined;
				},
			},
			observation: {
				instruction: dashboardChatObservationInstructions,
				manageWorkingMemory: true,
				model: models.cheapFast.model,
				observeAttachments: false,
				providerOptions: models.cheapFast.providerOptions,
			},
			reflection: {
				instruction: dashboardChatReflectionInstructions,
				model: models.cheapFast.model,
				providerOptions: models.cheapFast.providerOptions,
			},
			scope: "thread",
		},
		workingMemory: {
			agentManaged: false,
			enabled: true,
			scope: "resource",
			template: organizationWorkingMemoryTemplate,
			useStateSignals: false,
		},
	},
	storage: mastraStorage,
});

export const createDashboardWorkingMemoryProcessor = async () => {
	const memoryStore = await mastraStorage.getStore("memory");

	if (!memoryStore) {
		throw new Error("Mastra memory storage is not configured");
	}

	return new WorkingMemory({
		readOnly: true,
		scope: "resource",
		storage: memoryStore,
		template: { content: organizationWorkingMemoryTemplate, format: "markdown" },
		templateProvider: dashboardChatMemory,
	});
};
