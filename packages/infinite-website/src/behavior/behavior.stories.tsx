import type { Meta, StoryObj } from "@storybook/react-vite";

import type { SiteNode } from "../document/structure-schema";
import { StoryPreview } from "../storybook/story-preview";
import type { SiteBehaviorProgramV1 } from "./contracts";
import { BehaviorRuntimeBoundary } from "./runtime";

const meta = {
	component: StoryPreview,
	parameters: { layout: "fullscreen" },
	title: "Behavior/Interactive programs",
} satisfies Meta<typeof StoryPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

const label = ({ content, id }: { content: string; id: string }): SiteNode =>
	({
		id,
		props: { appearance: "body-sm-em", content, element: "span" },
		type: "text",
	}) satisfies SiteNode;

const fieldNode = ({
	content,
	id,
	placeholder,
	slot,
}: {
	content: string;
	id: string;
	placeholder: string;
	slot: string;
}): SiteNode =>
	({
		id,
		props: {
			children: [label({ content, id: `${id}_label` })],
			invalid: "Enter a valid decimal",
			placeholder,
			slot,
		},
		type: "field",
	}) satisfies SiteNode;

const valueNode = ({ content, id }: { content: string; id: string }): SiteNode =>
	({
		id,
		props: {
			children: [label({ content, id: `${id}_label` })],
			format: { currency: "USD", maximumFractionDigits: 0, style: "currency" },
			unavailable: "Unavailable",
			value: "result",
		},
		type: "value",
	}) satisfies SiteNode;

const triggerNode = ({ id }: { id: string }): SiteNode =>
	({
		id,
		props: {
			children: [label({ content: "View details", id: `${id}_label` })],
			event: "view_details",
			label: "View details",
		},
		type: "trigger",
	}) satisfies SiteNode;

const fieldsGrid = ({ id }: { id: string }): SiteNode =>
	({
		id,
		props: {
			children: [
				fieldNode({ content: "Hours", id: `${id}_hours`, placeholder: "40", slot: "input_0" }),
				fieldNode({ content: "Hourly rate", id: `${id}_rate`, placeholder: "125", slot: "input_1" }),
			],
			columns: { base: 1, compact: 2 },
			gap: "1rem",
		},
		type: "grid",
	}) satisfies SiteNode;

const demoTree = ({ children, id }: { children: Array<SiteNode>; id: string }): SiteNode =>
	({
		id,
		layout: {
			margin: { inlineEnd: "auto", inlineStart: "auto" },
			maxInlineSize: "36rem",
			padding: { blockEnd: "4rem", blockStart: "4rem", inlineEnd: "1.5rem", inlineStart: "1.5rem" },
		},
		props: { children, direction: "column", gap: "1.5rem" },
		type: "flex",
	}) satisfies SiteNode;

const behaviorTree = demoTree({
	children: [
		fieldsGrid({ id: "behavior_computed_fields" }),
		valueNode({ content: "Estimated cost", id: "behavior_value_total" }),
	],
	id: "behavior_computed",
});

const formulaProgram: SiteBehaviorProgramV1 = {
	behaviorVersion: 1,
	expressionProfile: "site-expression-v1",
	result: {
		lhs: { key: "input_0", type: "reference" },
		operator: "*",
		rhs: { key: "input_1", type: "reference" },
		type: "binary",
	},
	slots: [
		{ initial: "40", key: "input_0" },
		{ initial: "125", key: "input_1" },
	],
	source: "input_0 * input_1",
};

const scriptProgram: SiteBehaviorProgramV1 = {
	behaviorVersion: 1,
	expressionProfile: "custom-js-v1",
	initialOutputs: { result: "5000" },
	outputs: ["result"],
	script: "function calculate(inputs) { let total = 0; for (let hour = 1; hour <= inputs.input_0; hour += 1) { total += inputs.input_1; } return total; }",
	slots: [
		{ initial: "40", key: "input_0" },
		{ initial: "125", key: "input_1" },
	],
};

export const Field: Story = {
	args: { node: fieldNode({ content: "Hours", id: "behavior_field", placeholder: "40", slot: "input_0" }) },
};

export const Value: Story = {
	args: { node: valueNode({ content: "Estimated cost", id: "behavior_value" }) },
};

export const Trigger: Story = {
	args: { node: triggerNode({ id: "behavior_trigger" }) },
};

export const FormulaBehavior: Story = {
	args: { node: behaviorTree },
	render: (args) => (
		<BehaviorRuntimeBoundary program={formulaProgram}>
			<StoryPreview {...args} />
		</BehaviorRuntimeBoundary>
	),
};

export const ScriptBehavior: Story = {
	args: { node: behaviorTree },
	render: (args) => (
		<BehaviorRuntimeBoundary program={scriptProgram}>
			<StoryPreview {...args} />
		</BehaviorRuntimeBoundary>
	),
};
