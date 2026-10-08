import { grid, pad, space, text } from "../metrics/_shared/parts";
import { blogSection } from "./_shared/blog-header";

export const blogListSection = blogSection({
	header: grid({
		children: [
			text({ appearance: "heading-sm", element: "h2", pointer: "/copy/heading" }),
			text({ appearance: "body-sm", pointer: "/copy/description", tone: "muted" }),
		],
		columns: { base: 1, compact: 2 },
		gap: space({ base: 8, compact: 6 }),
		layout: { padding: pad({ bottom: 16 }) },
	}),
	pattern: "blog-list",
	top: { base: 20, compact: 24 },
});
