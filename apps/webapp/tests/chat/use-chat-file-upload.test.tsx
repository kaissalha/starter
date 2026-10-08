import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUpload: vi.fn(), get: vi.fn(), upload: vi.fn() }));

vi.mock("@/components/auth/auth-session-context", () => ({
	useAuthSession: () => ({ data: { session: { activeOrganizationId: "organization-1" } } }),
}));

vi.mock("@/lib/api-client", () => ({ client: { documents: { findUpload: mocks.findUpload, get: mocks.get } } }));

vi.mock("@/lib/storage", () => ({ uploadFromClient: mocks.upload }));

import { useChatFileUpload } from "@/components/chat/use-chat-file-upload";

describe("chat file uploads", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mocks.upload.mockResolvedValue({ url: "https://private.blob.example.com/brief.txt" });
		mocks.findUpload.mockResolvedValue({ id: "file-1" });
		mocks.get.mockResolvedValue({ ragStatus: "ready" });
	});

	it("stores persistent knowledge privately and waits for its registered file", async () => {
		const { result } = renderHook(() => useChatFileUpload({ uploadToKnowledgeBase: true }));
		const file = new File(["Private notes"], "brief.txt", { type: "text/plain" });
		await act(async () => result.current.handleFilesAdded([file]));
		await waitFor(() => expect(result.current.attachments[0]?.uploadStatus).toBe("uploaded"));
		expect(mocks.upload).toHaveBeenCalledWith(
			expect.objectContaining({
				file,
				pathname: expect.stringMatching(/^knowledge\/organization-1\/.+-brief\.txt$/),
				payload: {
					access: "private",
					maxFileSizeMb: 5,
					name: "brief.txt",
					organizationId: "organization-1",
					purpose: "knowledge",
				},
			})
		);
		expect(mocks.findUpload).toHaveBeenCalledWith(
			{ url: "https://private.blob.example.com/brief.txt" },
			expect.objectContaining({ signal: expect.any(AbortSignal) })
		);
		expect(result.current.attachments[0]?.fileId).toBe("file-1");
	});
});
