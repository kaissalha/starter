import type { Layout, SiteNodeDefinition } from "../../../document/structure-schema";
import { buttonRow, textNode } from "./parts";

export const centeredCopy = () => {
	const copyLayout = { inlineSize: "full", maxInlineSize: "42rem" } satisfies Layout;

	return [
		textNode({
			align: "center",
			appearance: "display-md",
			element: "h2",
			layout: copyLayout,
			pointer: "/copy/heading",
		}),
		{
			layout: copyLayout,
			props: {
				align: "center",
				children: [
					textNode({ align: "center", appearance: "body-md", pointer: "/copy/description", tone: "muted" }),
					buttonRow({ justify: "center", layout: { inlineSize: "full" } }),
				],
				direction: "column",
				gap: "8sp",
			},
			type: "flex",
		},
	] satisfies Array<SiteNodeDefinition>;
};
