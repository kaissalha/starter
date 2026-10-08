import type { ReactNode } from "react";

import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { fromMarkdown } from "mdast-util-from-markdown";

import { baseStyles } from "../components/styles";

type MarkdownNode = ReturnType<typeof fromMarkdown>["children"][number];

type InlineNode = Extract<MarkdownNode, { type: "paragraph" }>["children"][number];

const styles = StyleSheet.create({
	blockquote: { borderLeftColor: "#E8E7E1", borderLeftWidth: 2, color: "#707070", marginBottom: 10, paddingLeft: 10 },
	code: { backgroundColor: "#F4F4F2", fontFamily: "Courier", fontSize: 9, marginBottom: 10, padding: 8 },
	heading1: { fontSize: 22, fontWeight: 700, marginBottom: 12 },
	heading2: { fontSize: 16, fontWeight: 600, marginBottom: 8, marginTop: 10 },
	heading3: { fontSize: 12, fontWeight: 600, marginBottom: 6, marginTop: 8 },
	item: { flexDirection: "row", marginBottom: 4 },
	itemBody: { flex: 1 },
	list: { marginBottom: 6 },
	marker: { width: 16 },
	paragraph: { fontSize: 10, lineHeight: 1.5, marginBottom: 10 },
	rule: { borderBottomColor: "#E8E7E1", borderBottomWidth: 1, marginVertical: 12 },
});

const renderInline = (nodes: Array<InlineNode>): Array<ReactNode> =>
	nodes.map((node, index) => {
		switch (node.type) {
			case "text":
				return node.value;
			case "inlineCode":
				return (
					<Text key={index} style={{ fontFamily: "Courier" }}>
						{node.value}
					</Text>
				);
			case "break":
				return "\n";
			case "strong":
				return (
					<Text key={index} style={{ fontWeight: 700 }}>
						{renderInline(node.children)}
					</Text>
				);
			case "emphasis":
				return (
					<Text key={index} style={{ fontStyle: "italic" }}>
						{renderInline(node.children)}
					</Text>
				);
			case "link":
				return (
					<Link key={index} src={node.url}>
						{renderInline(node.children)}
					</Link>
				);
			default:
				return "children" in node ? renderInline(node.children) : null;
		}
	});

const renderBlocks = (nodes: Array<MarkdownNode>): Array<ReactNode> =>
	nodes.map((node, index) => {
		switch (node.type) {
			case "heading":
				return (
					<Text
						key={index}
						style={[styles.heading1, styles.heading2, styles.heading3][Math.min(node.depth, 3) - 1]}
					>
						{renderInline(node.children)}
					</Text>
				);
			case "paragraph":
				return (
					<Text key={index} style={styles.paragraph}>
						{renderInline(node.children)}
					</Text>
				);
			case "list":
				return (
					<View key={index} style={styles.list}>
						{node.children.map((item, itemIndex) => (
							<View key={itemIndex} style={styles.item}>
								<Text style={styles.marker}>
									{node.ordered ? `${(node.start ?? 1) + itemIndex}.` : "•"}
								</Text>
								<View style={styles.itemBody}>{renderBlocks(item.children)}</View>
							</View>
						))}
					</View>
				);
			case "blockquote":
				return (
					<View key={index} style={styles.blockquote}>
						{renderBlocks(node.children)}
					</View>
				);
			case "code":
				return (
					<Text key={index} style={styles.code}>
						{node.value}
					</Text>
				);
			case "thematicBreak":
				return <View key={index} style={styles.rule} />;
			default:
				return null;
		}
	});

export const MarkdownDocument = ({ markdown, title }: { markdown: string; title: string }) => (
	<Document title={title}>
		<Page size='A4' style={baseStyles.page}>
			{renderBlocks(fromMarkdown(markdown).children)}
		</Page>
	</Document>
);
