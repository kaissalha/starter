import { defineSection } from "../section-definition";

export const contactFormSection = defineSection({
	category: "contact",
	pattern: "contact-form",
	root: {
		props: {
			children: [
				{
					props: { content: { $text: "/copy/heading" }, element: "h2", font: "brand", fontSize: "2rem" },
					type: "text",
				},
				...(
					[
						"description",
						"nameLabel",
						"emailLabel",
						"phoneLabel",
						"messageLabel",
						"submitLabel",
						"pendingLabel",
						"success",
						"error",
						"preview",
						"anotherLabel",
					] as const
				).map((field) => ({
					props: {
						content: { $text: `/copy/${field}` },
						element: "p" as const,
						font: "body" as const,
						fontSize: "1rem",
					},
					type: "text" as const,
				})),
			],
			fill: "canvas",
		},
		type: "box",
	},
});
