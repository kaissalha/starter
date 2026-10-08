import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWebsiteTextEditor } from "@/app/[locale]/dashboard/website/editor/use-website-text-editor";
import { WebsiteTextAIEditor } from "@/app/[locale]/dashboard/website/editor/website-text-ai-editor";
import {
	initialWebsiteGenerationState,
	useWebsiteGenerationStore,
} from "@/app/[locale]/dashboard/website/generation/website-generation-store";
import {
	resolveSectionContentReference,
	listSectionContentReferences,
	stringValueSchema,
} from "@starter/infinite-website/editing";
import { createGenerationTemplateBrand, websiteGenerationProfiles } from "@starter/infinite-website/generation";
import { templatePreviews } from "@starter/infinite-website/template-previews";

const { edit, regenerate, showError } = vi.hoisted(() => ({ edit: vi.fn(), regenerate: vi.fn(), showError: vi.fn() }));

vi.mock("@/lib/api-client", () => ({
	client: { websites: { regenerateText: regenerate } },
}));

vi.mock("@starter/ui/components/toaster", () => ({ toast: { error: showError } }));

const preview = templatePreviews[0]!;

const profile = websiteGenerationProfiles.find(({ templateId }) => templateId === preview.id)!;

const snapshot = {
	assets: preview.assets,
	brand: createGenerationTemplateBrand({ locale: "en", profile }),
	document: preview.document,
	schemaVersion: 1 as const,
	templateId: preview.id,
};

const section = preview.document.structure.pages[0]!.sections[0]!;

const reference = listSectionContentReferences({ kind: "text", node: section.root })[0]!;

const value = stringValueSchema.parse(
	resolveSectionContentReference({
		content: preview.document.content,
		contentId: section.contentId,
		defaultLocale: preview.document.defaultLocale,
		locale: "en",
		reference,
	})
);

if (!("$text" in reference)) {
	throw new Error("Missing text fixture");
}

const target = {
	content: value,
	contentId: section.contentId,
	linkLabel: false,
	locale: "en" as const,
	nodeId: "text-node",
	pointer: reference.$text,
	sectionId: section.id,
};

const websiteId = "018ff7c2-1f7c-7b28-b6c1-3f2e60b5d32d";

const Editor = ({ disabled = false }: { disabled?: boolean }) => {
	const editor = { disabled, edit, pending: null };
	const state = useWebsiteTextEditor({ editor });

	return (
		<>
			<p {...state.textElementProps(target)}>{target.content}</p>
			{state.active && (
				<WebsiteTextAIEditor key={state.active.target.nodeId} state={{ ...state, active: state.active }} />
			)}
		</>
	);
};

const renderEditor = (disabled = false) => render(<Editor disabled={disabled} />);

beforeEach(() => {
	vi.clearAllMocks();
	edit.mockResolvedValue(true);
	regenerate.mockResolvedValue({ text: "New generated text" });
	useWebsiteGenerationStore.setState({ ...initialWebsiteGenerationState, snapshot, websiteId });
});

describe("inline website AI text editor", () => {
	it.each(["", "Make this more welcoming"])(
		"expands from hover and generates with optional instructions: %s",
		async (instruction) => {
			const saving = Promise.withResolvers<boolean>();
			edit.mockReturnValue(saving.promise);
			const user = userEvent.setup();
			renderEditor();
			const field = screen.getByRole("textbox", { name: "label" });
			fireEvent.pointerEnter(field);
			await user.click(field);
			await user.click(await screen.findByRole("button", { name: "title" }));
			const input = screen.getByRole("textbox", { name: "instruction" });
			expect(input).toHaveFocus();

			if (instruction) {
				await user.type(input, instruction);
			}

			await user.click(screen.getByRole("button", { name: "generate" }));
			await waitFor(() =>
				expect(edit).toHaveBeenCalledWith({
					locale: "en",
					operation: "update-text",
					pointer: target.pointer,
					sectionId: section.id,
					value: "New generated text",
				})
			);
			expect(field).toHaveAttribute("data-website-text-generating");
			expect(field).toHaveAttribute("aria-busy", "true");
			expect(field).toHaveAttribute("contenteditable", "false");
			expect(screen.getByRole("button", { name: "generating" })).toBeDisabled();
			await act(async () => saving.resolve(true));
			expect(field).not.toHaveAttribute("data-website-text-generating");
			expect(screen.queryByRole("button", { name: "generating" })).not.toBeInTheDocument();
			expect(regenerate).toHaveBeenCalledWith(
				expect.objectContaining({ instruction, value: target.content, websiteId }),
				expect.anything()
			);
		}
	);
	it.each(["close", "unmount"])("discards generation after %s", async (action) => {
		const user = userEvent.setup();
		const pending = Promise.withResolvers<{ text: string }>();
		regenerate.mockReturnValue(pending.promise);
		const view = renderEditor();
		act(() => screen.getByRole("textbox", { name: "label" }).focus());
		await user.click(await screen.findByRole("button", { name: "title" }));
		await user.click(screen.getByRole("button", { name: "generate" }));
		const generating = screen.getByRole("button", { name: "generating" });
		expect(generating).toBeDisabled();
		expect(generating).toBeVisible();
		expect(generating).toHaveTextContent("generating");
		expect(screen.getByRole("textbox", { name: "label" })).toHaveAttribute("data-website-text-generating");

		if (action === "close") {
			await user.click(screen.getByRole("button", { name: "close" }));
		} else {
			view.unmount();
		}

		await act(async () => pending.resolve({ text: "Too late" }));
		expect(edit).not.toHaveBeenCalled();
		expect(view.container.querySelector("[data-website-text-generating]")).toBeNull();
	});
	it("preserves manual typing and hides AI editing for read-only users", async () => {
		const user = userEvent.setup();
		const pending = Promise.withResolvers<{ text: string }>();
		regenerate.mockReturnValue(pending.promise);
		const view = renderEditor();
		const field = screen.getByRole("textbox", { name: "label" });
		fireEvent.pointerEnter(field);
		await user.click(await screen.findByRole("button", { name: "title" }));
		await user.click(screen.getByRole("button", { name: "generate" }));
		field.textContent = "A newer manual edit";
		await act(async () => pending.resolve({ text: "Old result" }));
		expect(edit).not.toHaveBeenCalled();
		expect(showError).toHaveBeenCalledWith("ai.changed");
		view.unmount();
		renderEditor(true);
		fireEvent.pointerEnter(screen.getByRole("textbox", { name: "label" }));
		expect(screen.queryByRole("button", { name: "title" })).not.toBeInTheDocument();
	});
});
