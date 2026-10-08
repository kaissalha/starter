import type { SectionContent, SectionStructure, SectionStructureNode } from "./specification";

type IssueContext = { addIssue: (issue: { code: "custom"; message: string; path: Array<number | string> }) => void };

const locales = ["en", "ar"] as const;

export const validateStructureLiveness = ({
	content,
	context,
	structure,
}: {
	content: SectionContent;
	context: IssueContext;
	structure: SectionStructure;
}) => {
	const nodeByKey = new Map(structure.nodes.map((node) => [node.key, node]));
	const blankLocales = (key: string) => locales.filter((locale) => !content[locale][key]?.trim());
	const isFilled = (key: string) => blankLocales(key).length === 0;

	const reaches = ({ matches, rootKey }: { matches: (node: SectionStructureNode) => boolean; rootKey: string }) => {
		const pending = [rootKey];
		const visited = new Set<string>();

		while (pending.length > 0) {
			const node = nodeByKey.get(pending.pop() ?? "");

			if (!node || visited.has(node.key)) {
				continue;
			}

			visited.add(node.key);

			if (matches(node)) {
				return true;
			}

			pending.push(...node.children);
		}

		return false;
	};

	const hasContent = (rootKey: string) =>
		reaches({
			matches: (node) =>
				(node.type === "text" && isFilled(node.props.content)) ||
				(node.type === "media" && isFilled(node.props.alt)) ||
				node.type === "embed",
			rootKey,
		});

	const hasName = (rootKey: string) =>
		reaches({
			matches: (node) =>
				(node.type === "text" && isFilled(node.props.content)) ||
				(node.type === "icon" && Boolean(node.props.label) && isFilled(node.props.label ?? "")) ||
				(node.type === "media" && isFilled(node.props.alt)),
			rootKey,
		});

	const requireFilled = ({
		key,
		node,
		property,
	}: {
		key: string | undefined;
		node: SectionStructureNode;
		property: string;
	}) => {
		if (key === undefined) {
			return;
		}

		blankLocales(key).forEach((locale) =>
			context.addIssue({
				code: "custom",
				message: `${node.type} node "${node.key}" ${property} "${key}" is blank in ${locale}`,
				path: ["content", locale],
			})
		);
	};

	const requireItems = ({ node, parts }: { node: SectionStructureNode; parts: (key: string) => Array<string> }) => {
		if (node.children.length === 0) {
			context.addIssue({
				code: "custom",
				message: `${node.type} node "${node.key}" needs at least one ${node.type === "carousel" ? "slide" : "item"} with content`,
				path: ["structure", "nodes"],
			});
		}

		node.children.forEach((child) =>
			parts(child).forEach((message) =>
				context.addIssue({
					code: "custom",
					message: `${node.type} node "${node.key}" ${message}`,
					path: ["structure", "nodes"],
				})
			)
		);
	};

	structure.nodes.forEach((node) => {
		if (node.type === "carousel") {
			requireFilled({ key: node.props.label, node, property: "label" });
			requireFilled({ key: node.props.previousLabel, node, property: "previousLabel" });
			requireFilled({ key: node.props.nextLabel, node, property: "nextLabel" });
			requireFilled({ key: node.props.dotsLabel, node, property: "dotsLabel" });
			requireItems({
				node,
				parts: (slide) => (hasContent(slide) ? [] : [`slide "${slide}" has no nonblank text or media`]),
			});
		}

		if (node.type === "tabs" || node.type === "disclosure") {
			requireFilled({ key: node.type === "tabs" ? node.props.label : undefined, node, property: "label" });
			requireItems({
				node,
				parts: (itemKey) => {
					const [trigger, panel] = nodeByKey.get(itemKey)?.children ?? [];

					return [
						...(trigger && hasName(trigger)
							? []
							: [`item "${itemKey}" trigger has no nonblank text for its accessible name`]),
						...(panel && hasContent(panel)
							? []
							: [`item "${itemKey}" panel has no nonblank text or media`]),
					];
				},
			});
		}

		if (node.type === "embed") {
			const { props } = node;
			requireFilled({ key: props.label, node, property: "label" });

			if (props.provider === "google-map") {
				if (!props.coordinates) {
					requireFilled({ key: props.address, node, property: "address" });
				}

				return;
			}

			[
				props.nameLabel,
				props.emailLabel,
				props.messageLabel,
				props.submitLabel,
				props.pendingLabel,
				props.success,
				props.error,
				props.anotherLabel,
				props.phoneLabel,
			].forEach((key) => requireFilled({ key, node, property: "contact-form label" }));
		}
	});
};
