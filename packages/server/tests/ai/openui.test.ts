import { createParser, type ParseResult } from "@openuidev/lang-core";
import { describe, expect, it } from "vitest";

import { getOpenUIValidationErrors, parseOpenUIFences } from "@starter/genui";

import { invalidOpenUIPrograms } from "../../../../tools/testing/invalid-openui-programs";
import openuiChatSpec from "../../src/ai/generated/openui-chat.spec.json" with { type: "json" };
import { openuiGenerativeUiPrompt } from "../../src/ai/skills";

const parser = createParser(openuiChatSpec.schema, openuiChatSpec.root);

const sources = new WeakMap<ParseResult, string>();

const parseChatGenUI = (source: string) => {
	const parsed = parser.parse(source);
	sources.set(parsed, source);

	return parsed;
};

const getChatGenUIValidationErrors = (parsed: ParseResult) =>
	getOpenUIValidationErrors({ expectedRoot: openuiChatSpec.root, parsed, source: sources.get(parsed) });

describe("OpenUI contract", () => {
	it("builds the prompt from the generated component spec", () => {
		expect(openuiGenerativeUiPrompt).not.toContain("Mutation(");
		expect(openuiGenerativeUiPrompt).not.toContain("Query(");
		expect(openuiGenerativeUiPrompt).not.toContain("Query statements");
		expect(openuiGenerativeUiPrompt).not.toContain("@Sum");
		expect(openuiGenerativeUiPrompt).not.toContain('$title=""');
	});

	it("uses the production line-based OpenUI fence semantics", () => {
		const source = 'root = Card([Metric("Revenue", "$15k")])';
		const exact = parseOpenUIFences(["```openui-lang", source, "```"].join("\n"));
		const incomplete = parseOpenUIFences(["```openui-lang", source].join("\n"));

		expect(exact).toEqual([{ complete: true, content: source, type: "openui" }]);
		expect(incomplete).toEqual([
			{
				complete: false,
				content: source,
				type: "openui",
			},
		]);
		expect(parseOpenUIFences(["```openui-lang", "```"].join("\n"))).toEqual([
			{ complete: true, content: "", type: "openui" },
		]);
		expect(parseOpenUIFences("```openui-lang")).toEqual([{ complete: false, content: "", type: "openui" }]);

		for (const wrapped of [
			["````markdown", "```openui-lang", source, "```", "````"].join("\n"),
			["    ```openui-lang", source, "    ```"].join("\n"),
			["<pre>", "```openui-lang", source, "```", "</pre>"].join("\n"),
			["````inline", "```openui-lang", source, "```", "ends````"].join("\n"),
		]) {
			expect(parseOpenUIFences(wrapped)).toEqual([{ content: wrapped, type: "markdown" }]);
		}

		for (const opener of ["````openui-lang", "text```openui-lang", "> ```openui-lang"]) {
			expect(parseOpenUIFences([opener, source, "```"].join("\n"))).not.toEqual(
				expect.arrayContaining([expect.objectContaining({ type: "openui" })])
			);
		}
	});

	it.each(invalidOpenUIPrograms)("rejects %s even when the parser can build a root", (_description, source) => {
		expect(getChatGenUIValidationErrors(parseChatGenUI(source))).not.toEqual([]);
	});

	it("accepts safe local and external button plans", () => {
		const local = parseChatGenUI(`$value = "old"
$other = "second"
root = Card([button])
button = Button("Update", Action([@Set($value, "new"), @Reset($value, $other)]))`);

		const external = parseChatGenUI(
			'root = Card([button])\nbutton = Button("Open", Action([@OpenUrl("https://example.com")]))'
		);

		expect(getChatGenUIValidationErrors(local)).toEqual([]);
		expect(getChatGenUIValidationErrors(external)).toEqual([]);
	});

	it("accepts meaningful localized shaping and multiline assistant text", () => {
		const parsed = parseChatGenUI(`root = Card([heart, family, arabic, explain])
heart = Button("❤️")
family = Button("👨‍👩‍👧‍👦")
arabic = Button("می‌روم")
explain = Button("Explain", Action([@ToAssistant("Explain\\nthis metric")]))`);

		expect(getChatGenUIValidationErrors(parsed)).toEqual([]);
	});

	it("uses locale-independent chart identity", () => {
		const parsed = parseChatGenUI(`root = Card([chart])
first = Series("I", [10])
second = Series("ı", [12])
chart = LineChart(["Jan"], [first, second])`);

		expect(getChatGenUIValidationErrors(parsed)).toEqual([]);
	});
});

describe("Spectrum OpenUI charts", () => {
	it.each(["AreaChart", "ComposedChart", "RadarChart"])(
		"accepts aligned %s series and rejects mismatched data",
		(name) => {
			const source = `root = Card([${name}(["Jan", "Feb"], [Series("Visitors", [10, 20])])])`;
			expect(getChatGenUIValidationErrors(parseChatGenUI(source))).toEqual([]);
			expect(getChatGenUIValidationErrors(parseChatGenUI(source.replace("[10, 20]", "[10]")))).not.toEqual([]);
		}
	);
	it.each(["PieChart", "RadialChart"])("accepts %s values and rejects negative or mismatched data", (name) => {
		const source = `root = Card([${name}(["Direct", "Search"], [10, 20])])`;
		expect(getChatGenUIValidationErrors(parseChatGenUI(source))).toEqual([]);

		for (const values of ["[-1, 20]", "[10]"]) {
			expect(getChatGenUIValidationErrors(parseChatGenUI(source.replace("[10, 20]", values)))).not.toEqual([]);
		}
	});
	it("accepts donut charts and rejects unsupported variants", () => {
		expect(
			getChatGenUIValidationErrors(parseChatGenUI('root = Card([PieChart(["Direct"], [10], "donut")])'))
		).toEqual([]);
		expect(
			getChatGenUIValidationErrors(parseChatGenUI('root = Card([PieChart(["Direct"], [10], "globe")])'))
		).not.toEqual([]);
	});
});
