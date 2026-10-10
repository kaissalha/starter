import { type ASTNode, type ElementNode, isASTNode, type ParseResult, walkAST } from "@openuidev/lang-core";
import { z } from "zod";

import { hasInexactOpenUINumberLiteral } from "./openui-source";
import {
	hasOpenUIVisibleContent,
	normalizeOpenUIActionText,
	normalizeOpenUIIdentityText,
	normalizeOpenUIVisibleText,
	OPENUI_CHART_MAGNITUDE_LIMIT,
} from "./text";

export { type OpenUIFenceSegment, parseOpenUIFences } from "./openui-source";

type OpenUIPropValue = ElementNode["props"][string];

type OpenUIComponent = { name: string; props: ElementNode["props"] };

const openUIElementNodeContract = z.looseObject({
	hasDynamicProps: z.boolean().optional(),
	partial: z.boolean(),
	props: z.looseObject({}),
	statementId: z.string().optional(),
	type: z.literal("element"),
	typeName: z.string(),
});

const barVariantSchema = z.enum(["grouped", "stacked"]);

const elementNodeSchema = z.custom<ElementNode>((value) => openUIElementNodeContract.safeParse(value).success);

const booleanSchema = z.boolean();

const buttonVariantSchema = z.enum(["primary", "secondary"]);

const cardChildNames = new Set([
	"AreaChart",
	"BarChart",
	"Button",
	"ComposedChart",
	"FunnelChart",
	"LineChart",
	"Metric",
	"PieChart",
	"RadarChart",
	"RadialChart",
	"Select",
]);

const chartNumberSchema = z.number().finite().min(-OPENUI_CHART_MAGNITUDE_LIMIT).max(OPENUI_CHART_MAGNITUDE_LIMIT);

const finiteNumberSchema = z.number().finite();

const forbiddenOperationNames = new Set(["Mutation", "Query", "Run"]);

const httpURLSchema = z.url().refine((value) => /^https?:\/\//u.test(value));

const lineVariantSchema = z.enum(["linear", "natural", "step"]);

const nonemptyStringSchema = z
	.string()
	.min(1)
	.refine((value) => value.trim().length > 0);

const supportedStateValueSchema = z.union([
	z
		.string()
		.refine(hasOpenUIVisibleContent)
		.refine((value) => value === normalizeOpenUIVisibleText(value)),
	finiteNumberSchema,
	z.boolean(),
	z.null(),
]);

const stringSchema = z.string();

const toneSchema = z.enum(["negative", "neutral", "positive"]);

const getOpenUIElementNode = (value: OpenUIPropValue) => {
	const element = elementNodeSchema.safeParse(value);

	return element.success ? element.data : undefined;
};

const getOpenUIComponent = (value: OpenUIPropValue): OpenUIComponent | undefined => {
	if (isASTNode(value) && value.k === "Comp") {
		return { name: value.name, props: value.mappedProps ?? {} };
	}

	const element = getOpenUIElementNode(value);

	return element ? { name: element.typeName, props: element.props } : undefined;
};

const visitOpenUIComponents = ({
	root,
	visit,
}: {
	root: ElementNode | null;
	visit: (component: OpenUIComponent) => void;
}) => {
	const visitValue = (value: OpenUIPropValue) => {
		if (Array.isArray(value)) {
			for (const item of value) {
				visitValue(item);
			}

			return;
		}

		if (isASTNode(value)) {
			walkAST(value, (node) => {
				if (node.k === "Comp") {
					visit({ name: node.name, props: node.mappedProps ?? {} });
				}
			});

			return;
		}

		const element = getOpenUIElementNode(value);

		if (!element) {
			return;
		}

		visit({ name: element.typeName, props: element.props });

		for (const prop of Object.values(element.props)) {
			visitValue(prop);
		}
	};

	if (root) {
		visitValue(root);
	}
};

const getReferencedStateNames = (root: ElementNode | null) => {
	const names = new Set<string>();

	const visitValue = (value: OpenUIPropValue) => {
		if (Array.isArray(value)) {
			for (const item of value) {
				visitValue(item);
			}

			return;
		}

		if (isASTNode(value)) {
			walkAST(value, (node) => {
				if (node.k === "StateRef") {
					names.add(node.n);
				}
			});

			return;
		}

		const element = getOpenUIElementNode(value);

		if (element) {
			for (const prop of Object.values(element.props)) {
				visitValue(prop);
			}
		}
	};

	if (root) {
		for (const prop of Object.values(root.props)) {
			visitValue(prop);
		}
	}

	return names;
};

const getArrayLengths = (value: OpenUIPropValue): Array<number> => {
	if (Array.isArray(value)) {
		return [value.length];
	}

	if (!isASTNode(value)) {
		return [];
	}

	if (value.k === "Arr") {
		return [value.els.length];
	}

	if (value.k !== "Ternary") {
		return [];
	}

	// oxlint-disable-next-line github/no-then -- `then` is an OpenUI conditional-expression branch.
	return [...getArrayLengths(value.then), ...getArrayLengths(value.else)];
};

const getSeriesValueLengths = (value: OpenUIPropValue): Array<number> => {
	if (Array.isArray(value)) {
		return value.flatMap(getSeriesValueLengths);
	}

	if (isASTNode(value)) {
		if (value.k === "Comp" && value.name === "Series") {
			return getArrayLengths(value.mappedProps?.values);
		}

		if (value.k === "Arr") {
			return value.els.flatMap(getSeriesValueLengths);
		}

		if (value.k === "Ternary") {
			// oxlint-disable-next-line github/no-then -- `then` is an OpenUI conditional-expression branch.
			return [...getSeriesValueLengths(value.then), ...getSeriesValueLengths(value.else)];
		}

		return [];
	}

	const element = getOpenUIElementNode(value);

	return element?.typeName === "Series" ? getArrayLengths(element.props.values) : [];
};

const lengthsAlign = (...groups: Array<Array<number>>) => {
	const lengths = groups.flat();

	return (
		groups.every((group) => group.length > 0) &&
		lengths.every((length) => length > 0) &&
		new Set(lengths).size === 1
	);
};

const getStaticNonemptyString = (value: OpenUIPropValue) => {
	const string = nonemptyStringSchema.safeParse(value);

	if (string.success) {
		return string.data;
	}

	if (!isASTNode(value) || value.k !== "Str") {
		return undefined;
	}

	const literal = nonemptyStringSchema.safeParse(value.v);

	return literal.success ? literal.data : undefined;
};

const getStaticString = (value: OpenUIPropValue) => {
	const string = stringSchema.safeParse(value);

	if (string.success) {
		return string.data;
	}

	return isASTNode(value) && value.k === "Str" ? value.v : undefined;
};

const getStaticCanonicalText = (value: OpenUIPropValue) => {
	const text = getStaticNonemptyString(value);

	return text !== undefined && hasOpenUIVisibleContent(text) && text === normalizeOpenUIVisibleText(text)
		? text
		: undefined;
};

const getStaticCanonicalTextKey = (value: OpenUIPropValue) => {
	const text = getStaticCanonicalText(value);

	return text === undefined ? undefined : normalizeOpenUIIdentityText(text).toLowerCase();
};

const getStaticActionText = (value: OpenUIPropValue) => {
	const text = getStaticNonemptyString(value);

	return text === undefined ? undefined : normalizeOpenUIActionText(text);
};

const isStaticFiniteNumber = (value: OpenUIPropValue) => {
	const number = finiteNumberSchema.safeParse(value);

	if (number.success) {
		return true;
	}

	return isASTNode(value) && value.k === "Num" && Number.isFinite(value.v);
};

const isStaticChartNumber = (value: OpenUIPropValue) => {
	const number = chartNumberSchema.safeParse(value);

	if (number.success) {
		return true;
	}

	return isASTNode(value) && value.k === "Num" && chartNumberSchema.safeParse(value.v).success;
};

const isStaticNonnegativeChartNumber = (value: OpenUIPropValue) => {
	const number = chartNumberSchema.safeParse(value);

	if (number.success) {
		return number.data >= 0;
	}

	return isASTNode(value) && value.k === "Num" && chartNumberSchema.safeParse(value.v).success && value.v >= 0;
};

const isStaticBoolean = (value: OpenUIPropValue) =>
	booleanSchema.safeParse(value).success || (isASTNode(value) && value.k === "Bool");

const isStaticNull = (value: OpenUIPropValue) => value === null || (isASTNode(value) && value.k === "Null");

const getDeclaredStateName = (value: ASTNode, stateDeclarations: ParseResult["stateDeclarations"]) =>
	value.k === "StateRef" && Object.hasOwn(stateDeclarations, value.n) ? value.n : undefined;

const isStaticActionValueCompatible = ({ initialValue, value }: { initialValue: unknown; value: ASTNode }) => {
	if (nonemptyStringSchema.safeParse(initialValue).success) {
		return getStaticCanonicalText(value) !== undefined;
	}

	if (finiteNumberSchema.safeParse(initialValue).success) {
		return isStaticFiniteNumber(value);
	}

	if (booleanSchema.safeParse(initialValue).success) {
		return isStaticBoolean(value);
	}

	if (initialValue === null) {
		return isStaticNull(value);
	}

	return false;
};

const getActionStepKind = ({
	stateDeclarations,
	stateValueDomains,
	step,
}: {
	stateDeclarations: ParseResult["stateDeclarations"];
	stateValueDomains: ReadonlyMap<string, ReadonlySet<string>>;
	step: ASTNode;
}): "external" | "local" | undefined => {
	if (step.k !== "Comp") {
		return undefined;
	}

	if (step.name === "OpenUrl") {
		const [url] = step.args;
		const literal = url ? getStaticNonemptyString(url) : undefined;

		return step.args.length === 1 && literal && httpURLSchema.safeParse(literal).success ? "external" : undefined;
	}

	if (step.name === "ToAssistant") {
		return step.args.length === 1 && getStaticActionText(step.args[0]) !== undefined ? "external" : undefined;
	}

	if (step.name === "Reset") {
		return step.args.length > 0 && step.args.every((target) => getDeclaredStateName(target, stateDeclarations))
			? "local"
			: undefined;
	}

	if (step.name !== "Set") {
		return undefined;
	}

	const [target, value] = step.args;
	const stateName = target ? getDeclaredStateName(target, stateDeclarations) : undefined;

	if (stateName === undefined || value === undefined || step.args.length !== 2) {
		return undefined;
	}

	if (!isStaticActionValueCompatible({ initialValue: stateDeclarations[stateName], value })) {
		return undefined;
	}

	const domain = stateValueDomains.get(stateName);
	const stringValue = getStaticString(value);

	return !domain || (stringValue !== undefined && domain.has(stringValue)) ? "local" : undefined;
};

const getButtonActionError = (
	{ name, props }: OpenUIComponent,
	stateDeclarations: ParseResult["stateDeclarations"],
	stateValueDomains: ReadonlyMap<string, ReadonlySet<string>>
) => {
	if (name !== "Button") {
		return undefined;
	}

	if (getStaticCanonicalText(props.label) === undefined) {
		return "OpenUI button labels must be static nonempty strings";
	}

	if (props.variant !== undefined && !buttonVariantSchema.safeParse(getStaticString(props.variant)).success) {
		return "OpenUI button variants must be static supported values";
	}

	const action = props.action;

	if (action === undefined) {
		return undefined;
	}

	if (
		!isASTNode(action) ||
		action.k !== "Comp" ||
		action.name !== "Action" ||
		action.args.length !== 1 ||
		action.args[0]?.k !== "Arr" ||
		action.args[0].els.length === 0
	) {
		return "OpenUI button actions must contain supported steps";
	}

	const steps = action.args[0].els;
	const kinds = steps.map((step) => getActionStepKind({ stateDeclarations, stateValueDomains, step }));

	if (kinds.some((kind) => kind === undefined)) {
		return "OpenUI button actions must contain supported valid steps";
	}

	const externalCount = kinds.filter((kind) => kind === "external").length;

	return externalCount === 0 || (externalCount === 1 && steps.length === 1)
		? undefined
		: "OpenUI button actions cannot mix local and external steps";
};

const staticArrayBranchesPass = ({
	isValidBranch,
	value,
}: {
	isValidBranch: (items: Array<OpenUIPropValue>) => boolean;
	value: OpenUIPropValue;
}): boolean => {
	if (Array.isArray(value)) {
		return isValidBranch(value);
	}

	if (!isASTNode(value)) {
		return false;
	}

	if (value.k === "Arr") {
		return isValidBranch(value.els);
	}

	if (value.k !== "Ternary") {
		return false;
	}

	// oxlint-disable-next-line github/no-then -- `then` is an OpenUI conditional-expression branch.
	const consequent = value.then;

	return (
		staticArrayBranchesPass({ isValidBranch, value: consequent }) &&
		staticArrayBranchesPass({ isValidBranch, value: value.else })
	);
};

const containsOnlyStaticArrayValues = ({
	isValid,
	value,
}: {
	isValid: (value: OpenUIPropValue) => boolean;
	value: OpenUIPropValue;
}) => staticArrayBranchesPass({ isValidBranch: (items) => items.length > 0 && items.every(isValid), value });

const hasUniqueStaticArrayValues = ({
	getValue,
	value,
}: {
	getValue: (value: OpenUIPropValue) => string | undefined;
	value: OpenUIPropValue;
}) =>
	staticArrayBranchesPass({
		isValidBranch: (items) => {
			const values = items.map(getValue);

			return values.every((item) => item !== undefined) && new Set(values).size === values.length;
		},
		value,
	});

const containsOnlyStaticCanonicalTexts = (value: OpenUIPropValue) =>
	containsOnlyStaticArrayValues({ isValid: (item) => getStaticCanonicalText(item) !== undefined, value });

const containsOnlyStaticFiniteNumbers = (value: OpenUIPropValue) =>
	containsOnlyStaticArrayValues({ isValid: isStaticChartNumber, value });

const containsOnlyStaticNonnegativeNumbers = (value: OpenUIPropValue) =>
	containsOnlyStaticArrayValues({ isValid: isStaticNonnegativeChartNumber, value });

const getResolvedString = ({
	stateDeclarations,
	value,
}: {
	stateDeclarations: ParseResult["stateDeclarations"];
	value: OpenUIPropValue;
}) => {
	if (!isASTNode(value) || value.k !== "StateRef") {
		return getStaticString(value);
	}

	const stateName = getDeclaredStateName(value, stateDeclarations);

	if (stateName === undefined) {
		return undefined;
	}

	const stateValue = stringSchema.safeParse(stateDeclarations[stateName]);

	return stateValue.success ? stateValue.data : undefined;
};

const isResolvedCanonicalText = ({
	allowEmpty,
	stateDeclarations,
	value,
}: {
	allowEmpty: boolean;
	stateDeclarations: ParseResult["stateDeclarations"];
	value: OpenUIPropValue;
}) => {
	const resolved = getResolvedString({ stateDeclarations, value });

	return (
		resolved !== undefined &&
		((allowEmpty && resolved.length === 0) ||
			(resolved.length > 0 &&
				hasOpenUIVisibleContent(resolved) &&
				resolved === normalizeOpenUIVisibleText(resolved)))
	);
};

const getMetricError = ({ name, props }: OpenUIComponent, stateDeclarations: ParseResult["stateDeclarations"]) => {
	if (name !== "Metric") {
		return undefined;
	}

	if (
		!isResolvedCanonicalText({ allowEmpty: false, stateDeclarations, value: props.label }) ||
		!isResolvedCanonicalText({ allowEmpty: false, stateDeclarations, value: props.value }) ||
		(props.detail !== undefined &&
			!isResolvedCanonicalText({ allowEmpty: true, stateDeclarations, value: props.detail }))
	) {
		return "OpenUI metric text must resolve to strings";
	}

	const tone = props.tone;

	if (tone === undefined) {
		return undefined;
	}

	return toneSchema.safeParse(getStaticString(tone)).success
		? undefined
		: "OpenUI metric tone must be a static supported value";
};

const getStaticSelectItem = (value: OpenUIPropValue) => {
	const item = getOpenUIComponent(value);

	if (item?.name !== "SelectItem") {
		return undefined;
	}

	const label = getStaticCanonicalText(item.props.label);
	const itemValue = getStaticCanonicalText(item.props.value);

	return label !== undefined && itemValue !== undefined ? { label, value: itemValue } : undefined;
};

type StaticSelectContract = { name: string; stateName: string; values: ReadonlySet<string> };

const getStaticSelectContract = (
	{ name, props }: OpenUIComponent,
	stateDeclarations: ParseResult["stateDeclarations"]
): StaticSelectContract | undefined => {
	if (name !== "Select") {
		return undefined;
	}

	const selectName = getStaticCanonicalText(props.name);

	if (
		selectName === undefined ||
		(props.placeholder !== undefined && getStaticCanonicalText(props.placeholder) === undefined) ||
		!isASTNode(props.value) ||
		props.value.k !== "StateRef" ||
		!Array.isArray(props.items)
	) {
		return undefined;
	}

	const stateName = getDeclaredStateName(props.value, stateDeclarations);

	if (stateName === undefined) {
		return undefined;
	}

	const initialState = nonemptyStringSchema.safeParse(stateDeclarations[stateName]);

	if (
		!initialState.success ||
		!hasOpenUIVisibleContent(initialState.data) ||
		initialState.data !== normalizeOpenUIVisibleText(initialState.data)
	) {
		return undefined;
	}

	const parsedItems = props.items.map(getStaticSelectItem);

	if (parsedItems.some((item) => item === undefined)) {
		return undefined;
	}

	const items = parsedItems.flatMap((item) => (item ? [item] : []));
	const labels = items.map(({ label }) => normalizeOpenUIIdentityText(label).toLowerCase());
	const values = items.map(({ value }) => value);

	return values.length > 0 &&
		new Set(labels).size === labels.length &&
		new Set(values).size === values.length &&
		values.includes(initialState.data)
		? { name: selectName, stateName, values: new Set(values) }
		: undefined;
};

const getSelectError = (component: OpenUIComponent, stateDeclarations: ParseResult["stateDeclarations"]) =>
	component.name === "Select" && !getStaticSelectContract(component, stateDeclarations)
		? "OpenUI selects require canonical unique items and a matching declared string binding"
		: undefined;

const isStaticSeries = (value: OpenUIPropValue) => {
	const series = getOpenUIComponent(value);

	return (
		series?.name === "Series" &&
		getStaticCanonicalText(series.props.category) !== undefined &&
		containsOnlyStaticFiniteNumbers(series.props.values)
	);
};

const getStaticSeriesCategory = (value: OpenUIPropValue) => {
	const series = getOpenUIComponent(value);

	return series?.name === "Series" ? getStaticCanonicalTextKey(series.props.category) : undefined;
};

const containsOnlyStaticSeries = (value: OpenUIPropValue) =>
	containsOnlyStaticArrayValues({ isValid: isStaticSeries, value });

const containsOnlyStaticNonnegativeSeries = (value: OpenUIPropValue) =>
	containsOnlyStaticArrayValues({
		isValid: (item) => {
			const series = getOpenUIComponent(item);

			return series?.name === "Series" && containsOnlyStaticNonnegativeNumbers(series.props.values);
		},
		value,
	});

const getCardError = ({ name, props }: OpenUIComponent) => {
	if (name !== "Card") {
		return undefined;
	}

	return containsOnlyStaticArrayValues({
		isValid: (value) => {
			const child = getOpenUIComponent(value);

			return child !== undefined && cardChildNames.has(child.name);
		},
		value: props.children,
	})
		? undefined
		: "OpenUI card children must be a nonempty static component array";
};

const getChartAlignmentError = ({ name, props }: OpenUIComponent) => {
	if (["AreaChart", "BarChart", "ComposedChart", "LineChart", "RadarChart"].includes(name)) {
		const variantIsValid =
			props.variant === undefined ||
			(name === "BarChart"
				? barVariantSchema.safeParse(getStaticString(props.variant)).success
				: lineVariantSchema.safeParse(getStaticString(props.variant)).success);

		if (!variantIsValid) {
			return `${name} variants must be static supported values`;
		}

		if (
			(name === "RadarChart" || (name === "BarChart" && getStaticString(props.variant) === "stacked")) &&
			!containsOnlyStaticNonnegativeSeries(props.series)
		) {
			return `${name} series values must be nonnegative`;
		}

		if (!containsOnlyStaticCanonicalTexts(props.labels) || !containsOnlyStaticSeries(props.series)) {
			return `${name} labels and series must contain static typed data`;
		}

		if (
			!hasUniqueStaticArrayValues({ getValue: getStaticCanonicalTextKey, value: props.labels }) ||
			!hasUniqueStaticArrayValues({ getValue: getStaticSeriesCategory, value: props.series })
		) {
			return `${name} labels and series categories must be unique`;
		}

		return lengthsAlign(getArrayLengths(props.labels), getSeriesValueLengths(props.series))
			? undefined
			: `${name} series values must align exactly with its labels`;
	}

	if (["FunnelChart", "PieChart", "RadialChart"].includes(name)) {
		if (
			name === "PieChart" &&
			props.variant !== undefined &&
			!["pie", "donut"].includes(getStaticString(props.variant) ?? "")
		) {
			return "PieChart variants must be static supported values";
		}

		if (!containsOnlyStaticCanonicalTexts(props.labels)) {
			return `${name} labels must be static nonempty strings`;
		}

		if (!hasUniqueStaticArrayValues({ getValue: getStaticCanonicalTextKey, value: props.labels })) {
			return `${name} labels must be unique`;
		}

		if (!containsOnlyStaticNonnegativeNumbers(props.values)) {
			return `${name} values must be static nonnegative numbers`;
		}

		return lengthsAlign(getArrayLengths(props.labels), getArrayLengths(props.values))
			? undefined
			: `${name} values must align exactly with its labels`;
	}

	return undefined;
};

export const getOpenUIValidationErrors = ({
	expectedRoot,
	parsed,
	source,
}: {
	expectedRoot: string;
	parsed: ParseResult;
	source?: string;
}) => {
	const components: Array<OpenUIComponent> = [];
	const errors = new Set<string>();
	const referencedStateNames = getReferencedStateNames(parsed.root);
	const selectNames = new Set<string>();
	const selectStateNames = new Set<string>();
	const stateValueDomains = new Map<string, ReadonlySet<string>>();

	if (parsed.meta.incomplete) {
		errors.add("OpenUI program is incomplete");
	}

	if (parsed.root?.statementId !== "root" || parsed.root.typeName !== expectedRoot || parsed.root.partial) {
		errors.add(`OpenUI root is not a complete ${expectedRoot} assigned to root`);
	}

	for (const error of parsed.meta.errors) {
		errors.add(JSON.stringify(error));
	}

	for (const unresolved of parsed.meta.unresolved) {
		errors.add(`Unresolved OpenUI reference: ${JSON.stringify(unresolved)}`);
	}

	for (const orphaned of parsed.meta.orphaned) {
		errors.add(`Orphaned OpenUI statement: ${JSON.stringify(orphaned)}`);
	}

	if (parsed.queryStatements.length > 0) {
		errors.add("OpenUI queries are not allowed");
	}

	if (parsed.mutationStatements.length > 0) {
		errors.add("OpenUI mutations are not allowed");
	}

	if (source !== undefined && hasInexactOpenUINumberLiteral(source)) {
		errors.add("OpenUI numeric literals must round-trip exactly within the supported range");
	}

	for (const [name, value] of Object.entries(parsed.stateDeclarations)) {
		if (!referencedStateNames.has(name)) {
			errors.add("OpenUI state declarations must be referenced by the rendered program");
		}

		if (!supportedStateValueSchema.safeParse(value).success) {
			errors.add("OpenUI state declarations must contain canonical scalar values");
		}
	}

	visitOpenUIComponents({ root: parsed.root, visit: (component) => components.push(component) });

	for (const component of components) {
		const select = getStaticSelectContract(component, parsed.stateDeclarations);

		if (select) {
			stateValueDomains.set(select.stateName, select.values);
		}
	}

	for (const component of components) {
		if (forbiddenOperationNames.has(component.name)) {
			errors.add("OpenUI tool operations are not allowed");
		}

		for (const componentError of [
			getChartAlignmentError(component),
			getCardError(component),
			getButtonActionError(component, parsed.stateDeclarations, stateValueDomains),
			getMetricError(component, parsed.stateDeclarations),
			getSelectError(component, parsed.stateDeclarations),
		]) {
			if (componentError) {
				errors.add(componentError);
			}
		}

		const select = getStaticSelectContract(component, parsed.stateDeclarations);

		if (!select) {
			continue;
		}

		if (selectNames.has(select.name)) {
			errors.add("OpenUI select names must be unique");
		}

		selectNames.add(select.name);

		if (selectStateNames.has(select.stateName)) {
			errors.add("OpenUI selects must use unique state bindings");
		}

		selectStateNames.add(select.stateName);
	}

	return [...errors];
};
