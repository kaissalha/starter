import { defineSection } from "../section-definition";

const blogLatestSection = defineSection({
	category: "content",
	pattern: "blog-latest-three",
	root: {
		props: {
			children: [
				{
					props: { content: { $text: "/copy/heading" }, element: "h2", font: "brand", fontSize: "2rem" },
					type: "text",
				},
				{
					props: { content: { $text: "/copy/empty" }, element: "p", font: "body", fontSize: "1rem" },
					type: "text",
				},
			],
			fill: "canvas",
		},
		type: "box",
	},
});

export const blogLatestThreeSection = blogLatestSection;

export const blogLatestSixSection = defineSection({ ...blogLatestSection, pattern: "blog-latest-six" });
