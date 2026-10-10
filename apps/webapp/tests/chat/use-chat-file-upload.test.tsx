import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), upload: vi.fn() }));

vi.mock("@/components/auth/auth-session-context", () => ({
	useAuthSession: () => ({ data: { session: { activeOrganizationId: "organization-1" } } }),
}));

vi.mock("@/lib/api-client", () => ({ client: { documents: { get: mocks.get } } }));

vi.mock("@/lib/storage", () => ({ uploadFile: mocks.upload }));

import { useChatFileUpload } from "@/components/chat/use-chat-file-upload";

describe("chat file uploads", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mocks.upload.mockResolvedValue({ id: "file-1", url: "/api/media?fileId=file-1" });
		mocks.get.mockResolvedValue({ ragStatus: "ready" });
	});

	it("stores persistent knowledge privately and attaches its registered file", async () => {
		const { result } = renderHook(() => useChatFileUpload());
		const file = new File(["Private notes"], "brief.txt", { type: "text/plain" });
		await act(async () => result.current.handleFilesAdded([file]));
		await waitFor(() => expect(result.current.attachments[0]?.uploadStatus).toBe("uploaded"));
		expect(mocks.upload).toHaveBeenCalledWith({
			file,
			organizationId: "organization-1",
			purpose: "knowledge",
			signal: expect.any(AbortSignal),
		});
		expect(result.current.attachments[0]?.fileId).toBe("file-1");
	});
});
