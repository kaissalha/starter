import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { AskUserQuestions, type AskUserQuestion } from "@/components/chat/chat-input/ask-user-questions";

const questions: Array<AskUserQuestion> = [
	{
		id: "business_focus",
		multiSelect: false,
		options: [
			{ description: "Coaching practice", id: "life_coaching", title: "Life Coaching" },
			{ description: "Cleaning business", id: "luma_cleaning", title: "LUMA Residential Cleaning" },
			{ description: "Tips for both ventures", id: "both", title: "Both" },
		],
		title: "Which business are you looking to improve?",
	},
	{
		id: "improvement_area",
		multiSelect: false,
		options: [
			{ description: "More clients", id: "marketing", title: "Marketing & Branding" },
			{ description: "Processes", id: "operations", title: "Operations & Systems" },
		],
		title: "What area would you like to focus on?",
	},
];

beforeAll(() => {
	class ResizeObserverStub {
		observe() {}
		unobserve() {}
		disconnect() {}
	}

	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

describe("AskUserQuestions", () => {
	it("renders the first question and walks to completion", async () => {
		const onComplete = vi.fn();

		render(<AskUserQuestions onComplete={onComplete} questions={questions} />);

		expect(screen.getByText("Which business are you looking to improve?")).toBeDefined();
		expect(screen.getByText("progress")).toBeDefined();

		fireEvent.click(screen.getAllByText("Life Coaching")[0]!);

		expect(await screen.findByText("What area would you like to focus on?")).toBeDefined();

		fireEvent.click(screen.getAllByText("Marketing & Branding")[0]!);

		expect(onComplete).toHaveBeenCalledTimes(1);
		const answers = onComplete.mock.calls[0][0];
		expect(answers.business_focus.selectedIds).toEqual(["life_coaching"]);
		expect(answers.improvement_area.selectedIds).toEqual(["marketing"]);
	});
});
