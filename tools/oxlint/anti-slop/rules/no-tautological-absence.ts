import { defineRule } from "@oxlint/plugins";

import { findTautologicalAbsenceMatches, otherTautologicalAbsenceContents } from "../shared/tautological-absence.ts";

export const noTautologicalAbsenceRule = defineRule({
	meta: {
		docs: { description: "Reject instructional-copy absence assertions when the copy exists only in that assertion." },
		messages: { vanishedCopy: "Remove this absence assertion: {{needle}} appears nowhere else in the repository." },
		schema: [],
		type: "problem",
	},
	createOnce(context) {
		return {
			Program() {
				const source = context.sourceCode.getText();
				for (const match of findTautologicalAbsenceMatches({
					content: source,
					otherContents: otherTautologicalAbsenceContents(context.filename),
					relativePath: context.filename,
				})) {
					context.report({ data: { needle: JSON.stringify(match.needle) }, loc: { end: context.sourceCode.getLocFromIndex(match.end), start: context.sourceCode.getLocFromIndex(match.start) }, messageId: "vanishedCopy" });
				}
			},
		};
	},
});
