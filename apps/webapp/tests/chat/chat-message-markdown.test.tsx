import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatMessageMarkdown } from "@/components/chat/message/chat-message-markdown";

const { download } = vi.hoisted(() => ({ download: vi.fn() }));

vi.mock("@/utils/download-content", () => ({ downloadContent: download }));

const markdown = "| Name | Count |\n| --- | --- |\n| Coffee | 2 |";

beforeEach(() => {
	download.mockClear();
	Element.prototype.scrollTo = vi.fn();
});

describe("chat markdown controls", () => {
	it.each([
		["csv", "Name,Count\nCoffee,2"],
		["tsv", "Name\tCount\nCoffee\t2"],
		["md", "| Name | Count |\n| --- | --- |\n| Coffee | 2 |"],
	])("copies a table as %s through the keyboard menu", async (format, expected) => {
		const user = userEvent.setup();
		const copy = vi.spyOn(navigator.clipboard, "writeText");
		render(<ChatMessageMarkdown>{markdown}</ChatMessageMarkdown>);
		const trigger = screen.getByRole("button", { name: "copy" });
		trigger.focus();
		await user.keyboard("{Enter}");
		const item = await screen.findByRole("menuitem", { name: format });
		item.focus();
		await user.keyboard("{Enter}");
		await waitFor(() => expect(copy).toHaveBeenCalledWith(expected));
		expect(await screen.findByRole("button", { name: "copied" })).toBeInTheDocument();
	});

	it("downloads table content from fullscreen and restores focus on Escape", async () => {
		const user = userEvent.setup();
		render(<ChatMessageMarkdown>{markdown}</ChatMessageMarkdown>);
		const trigger = screen.getByRole("button", { name: "viewFullscreen" });
		await user.click(trigger);
		const dialog = await screen.findByRole("dialog", { name: "viewFullscreen" });
		expect(within(dialog).getByRole("cell", { name: "Coffee" })).toBeInTheDocument();
		await user.click(within(dialog).getByRole("button", { name: "download" }));
		await user.click(await screen.findByRole("menuitem", { name: "csv" }));
		expect(download).toHaveBeenCalledWith({
			content: "Name,Count\nCoffee,2",
			filename: "table.csv",
			type: "text/csv;charset=utf-8",
		});
		await user.keyboard("{Escape}");
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
		await waitFor(() => expect(trigger).toHaveFocus());
	});

	it("keeps code copy and download actions and inline code", async () => {
		const user = userEvent.setup();
		const copy = vi.spyOn(navigator.clipboard, "writeText");
		render(<ChatMessageMarkdown>{"Inline `coffee`\n\n```js\nconst count = 2;\n```"}</ChatMessageMarkdown>);
		expect(screen.getByText("coffee").tagName).toBe("CODE");
		await user.click(screen.getByRole("button", { name: "copyCode" }));
		await waitFor(() => expect(copy).toHaveBeenCalledWith("const count = 2;\n"));
		await user.click(screen.getByRole("button", { name: "downloadCode" }));
		expect(download).toHaveBeenCalledWith(
			expect.objectContaining({ content: "const count = 2;\n", filename: "code.js" })
		);
	});

	it("disables content actions while a response is streaming", () => {
		render(
			<ChatMessageMarkdown streaming>{`${markdown}\n\n\`\`\`js\nconst count = 2;\n\`\`\``}</ChatMessageMarkdown>
		);

		for (const name of ["copy", "download", "viewFullscreen", "copyCode", "downloadCode"]) {
			expect(screen.getByRole("button", { name })).toBeDisabled();
		}
	});
});
