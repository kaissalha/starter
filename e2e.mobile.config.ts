import { web } from "@e2e-dev/web";
import { gateway } from "ai";
import type { E2EConfig } from "e2e";

const context = [
	"starter is a dashboard where a small business builds a website and a link-in-bio page called Links.",
	"The screen is a phone. The dashboard sections are behind the Toggle navigation menu button at the top left.",
	"In the Website and Links editors, the Customize button in the header opens a bottom sheet named Customize with Design and Agent tabs. Design panels in that sheet end with Cancel and Done; Done saves the panel.",
	"Each website section has a Section controls toolbar (Media, Design, Move section up, Move section down, Delete section) that stays hidden and cannot be tapped until you tap that section's text first.",
	"Tapping a link in the Links preview shows a Section actions bar at the bottom of the screen: Design, Move up, Move down, Delete. Add section buttons add new links and sections.",
	"Text on the website and Links previews is edited in place and saves when it loses focus.",
	"The rocket button named Open publish panel opens the panel that publishes the website or the Links page.",
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
	targets: [
		{
			app: { url: "http://localhost:3100" },
			engine: web({ viewport: { height: 844, width: 390 } }),
			name: "phone",
		},
	],
	tests: "e2e/mobile/**/*.e2e.ts",
	timeout: 240_000,
	workers: 1,
} satisfies E2EConfig;
