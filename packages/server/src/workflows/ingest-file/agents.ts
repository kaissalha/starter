import { Agent } from "@mastra/core/agent";

import { models } from "../../ai/models";
import { fileClassificationSystemPrompt, imageClassificationSystemPrompt } from "../../ai/prompts";

export const documentClassifierAgent = new Agent({
	description: "Extracts untrusted document metadata for the knowledge library.",
	id: "document-classifier",
	instructions: fileClassificationSystemPrompt,
	model: models.cheapFast.model,
	name: "Document Classifier",
});

export const imageClassifierAgent = new Agent({
	description: "Extracts untrusted image metadata and visible text for the knowledge library.",
	id: "image-classifier",
	instructions: imageClassificationSystemPrompt,
	model: models.vision.model,
	name: "Image Classifier",
});
