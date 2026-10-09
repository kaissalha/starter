import { web } from "@e2e-dev/web";
import { gateway } from "ai";
import type { E2EConfig } from "e2e";

const context = [
	"starter is an organization dashboard with an AI assistant, a Library of documents and images, and notifications.",
	"The screen is a phone. The dashboard sections are behind the Toggle navigation menu button at the top left.",
].join(" ");

// oxlint-disable-next-line import/no-default-export -- The e2e runner loads this configuration through its default export.
export default {
	agents: {
		default: {
			context,
			model: gateway("openai/gpt-6-luna-fast"),
			system: "You are a careful QA tester holding a phone. Use taps and typing only, the way a phone user would, and never rely on hover or keyboard shortcuts. Finish only when the requested outcome is visible on screen.",
		},
	},
	projectId: "starter",
	targets: [
		{
			app: { url: "http://localhost:3100" },
			engine: web({ viewport: { height: 844, width: 390 } }),
			name: "phone",
		},
	],
	tests: "mobile/**/*.e2e.ts",
	timeout: 240_000,
	workers: 1,
} satisfies E2EConfig;
