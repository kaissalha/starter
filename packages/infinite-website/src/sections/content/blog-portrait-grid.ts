import { blogHeaderRow, blogSection, blogTitleBlock } from "./_shared/blog-header";

export const blogPortraitGridSection = blogSection({
	header: blogHeaderRow({
		align: "center",
		gap: { base: 6, compact: 6 },
		padBottom: { base: 8, compact: 8 },
		title: blogTitleBlock({ headingAppearance: "heading-sm" }),
	}),
	pattern: "blog-portrait-grid",
	top: { base: 12, compact: 16 },
});
