import { flex, pad } from "../metrics/_shared/parts";
import { blogSection, blogTitleBlock } from "./_shared/blog-header";

export const blogFeedSection = blogSection({
	header: flex({
		children: [blogTitleBlock({ maxInlineSize: "42rem" })],
		layout: { padding: pad({ bottom: { base: 8, compact: 12 } }) },
	}),
	pattern: "blog-feed",
	top: { base: 12, compact: 16 },
});
