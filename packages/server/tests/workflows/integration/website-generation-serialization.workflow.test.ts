import { beforeAll, describe, expect, it } from "vitest";
import { getRun, start } from "workflow/api";

import { listGenerationSlots, websiteGenerationProfiles } from "@starter/infinite-website/generation";

import {
	websiteGenerationSerializationWorkflow,
	websiteMutationSerializationWorkflow,
	websiteRepeaterSerializationWorkflow,
} from "./website-generation-serialization.workflow";

const registerWorkflow = ({ name, workflow }: { name: string; workflow: object }) => {
	Object.assign(workflow, {
		workflowId: `workflow//./website-generation-serialization.workflow//${name}`,
	});
};

beforeAll(() => {
	registerWorkflow({
		name: "websiteGenerationSerializationWorkflow",
		workflow: websiteGenerationSerializationWorkflow,
	});

	registerWorkflow({ name: "websiteRepeaterSerializationWorkflow", workflow: websiteRepeaterSerializationWorkflow });
	registerWorkflow({ name: "websiteMutationSerializationWorkflow", workflow: websiteMutationSerializationWorkflow });
});

describe("website generation Workflow integration", () => {
	it("serializes every profile through preparation, replay boundaries, and persisted completion", async () => {
		const templateIds = websiteGenerationProfiles.slice(0, 2).map(({ templateId }) => templateId);
		const run = await start(websiteGenerationSerializationWorkflow, [templateIds]);
		const completed = await run.returnValue;

		expect(completed).toMatchObject({ profileCount: templateIds.length });
		expect(completed.profiles.map(({ templateId }) => templateId)).toEqual(templateIds);
		expect(completed.profiles.every(({ locales }) => locales.join(",") === "en,ar")).toBe(true);
		expect(completed.profiles.every(({ patternOnlySources }) => patternOnlySources)).toBe(true);
		expect(await run.status).toBe("completed");

		const rehydrated = getRun<typeof completed>(run.runId);
		expect(await rehydrated.returnValue).toEqual(completed);
		expect(await rehydrated.status).toBe("completed");
	}, 60_000);

	it("preserves expanded FAQ repeater identities across durable steps", async () => {
		const profile = websiteGenerationProfiles.find((candidate) =>
			listGenerationSlots({ profile: candidate }).some(
				({ definition }) => definition.category === "faq" && (definition.repeaters?.length ?? 0) > 0
			)
		);

		if (!profile) {
			throw new Error("Expected a generation profile with a repeatable FAQ");
		}

		const run = await start(websiteRepeaterSerializationWorkflow, [profile.templateId]);
		const completed = await run.returnValue;

		expect(completed.pattern).toMatch(/^faq-/u);
		expect(completed.collections.length).toBeGreaterThan(0);
		expect(completed.collections.some(({ itemCount }) => itemCount > 0)).toBe(true);

		expect(completed.collections.every(({ itemCount, uniqueItemCount }) => itemCount === uniqueItemCount)).toBe(
			true
		);

		expect(await run.status).toBe("completed");
	});

	it("serializes section addition and layout generation through completion", async () => {
		const templateId = websiteGenerationProfiles[0]?.templateId;

		if (!templateId) {
			throw new Error("Expected a generation profile");
		}

		const run = await start(websiteMutationSerializationWorkflow, [templateId]);

		await expect(run.returnValue).resolves.toMatchObject({
			layoutGeneration: { locales: ["en", "ar"], preservedSectionId: true },
			sectionAddition: { locales: ["en", "ar"], pattern: "text-basic" },
		});

		expect(await run.status).toBe("completed");
	});
});
