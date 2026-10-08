import { blogHeaderRow, blogSection, blogTitleBlock } from "./_shared/blog-header";

export const blogFeaturedSection = blogSection({
	header: blogHeaderRow({
		align: "end",
		gap: { base: 4, compact: 8 },
		padBottom: { base: 8, compact: 12 },
		title: blogTitleBlock(),
	}),
	pattern: "blog-featured",
	top: { base: 12, compact: 16 },
});
