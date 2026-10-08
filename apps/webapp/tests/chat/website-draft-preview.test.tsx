import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WebsiteDraftPreview } from "@/components/chat/message/parts/website-draft-preview";

const mocks = vi.hoisted(() => ({ preview: vi.fn(), queryOptions: vi.fn() }));

vi.mock("@/lib/api-client", () => ({
	apiClient: {
		websites: {
			previewSection: {
				queryOptions: (options: { input: unknown }) => {
					mocks.queryOptions(options);

					return { ...options, queryFn: mocks.preview, queryKey: ["previewSection", options.input] };
				},
			},
		},
	},
}));

vi.mock("@/components/chat/message/parts/website-draft-preview-frame", () => ({
	WebsiteDraftPreviewFrame: ({ mobile }: { mobile: boolean }) => (
		<div data-testid='frame'>{mobile ? "mobile" : "desktop"}</div>
	),
}));

const input = { page: "p0", revision: "revision-1" };

const renderPreview = () =>
	render(
		<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
			<WebsiteDraftPreview input={input} tool='composeWebsiteSection' />
		</QueryClientProvider>
	);

describe("WebsiteDraftPreview", () => {
	it("renders the proposed section and switches between desktop and mobile", async () => {
		mocks.preview.mockResolvedValue({ document: {} });
		const user = userEvent.setup();
		renderPreview();

		expect(await screen.findByTestId("frame")).toHaveTextContent("desktop");
		expect(mocks.queryOptions).toHaveBeenCalledWith(
			expect.objectContaining({ input: { input, tool: "composeWebsiteSection" } })
		);
		await user.click(screen.getByRole("button", { name: "mobile" }));
		expect(screen.getByTestId("frame")).toHaveTextContent("mobile");
	});

	it.each([
		["has no visual change", () => mocks.preview.mockResolvedValue(null)],
		["is rejected", () => mocks.preview.mockRejectedValue(new Error("INVALID_DRAFT"))],
	])("renders nothing when the draft %s", async (_name, arrange) => {
		arrange();
		const { container } = renderPreview();

		await waitFor(() => expect(mocks.preview).toHaveBeenCalled());
		await waitFor(() => expect(container).toBeEmptyDOMElement());
	});
});
