import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChatState } from "@/components/chat/use-chat-state";

import { mockOrganizationPermissions } from "../mocks/organization-permissions";

const chatMocks = vi.hoisted(() => ({
	clearAttachments: vi.fn(),
	removeAttachment: vi.fn(),
	sendMessage: vi.fn(),
	stop: vi.fn(),
	waitForAttachmentUploads: vi.fn(),
}));

const attachment = {
	file: new File(["notes"], "notes.txt", { type: "text/plain" }),
	filename: "notes.txt",
	id: "attachment-1",
	mediaType: "text/plain",
	uploadProgress: 50,
	uploadStatus: "uploading" as const,
	url: "data:text/plain;base64,bm90ZXM=",
};

type UploadResolverReference = {
	resolve?: (attachments: Array<typeof attachment>) => void;
};

type SendResolverReference = {
	resolve?: () => void;
};

type SendRejecterReference = {
	reject?: (error: Error) => void;
};

vi.mock("@/components/chat/chat-session", () => ({
	useChatSession: () => ({
		actions: { sendMessage: chatMocks.sendMessage, stop: chatMocks.stop },
		isLoading: false,
	}),
}));

vi.mock("@/components/chat/use-chat-file-upload", () => ({
	useChatFileUpload: () => ({
		attachmentError: null,
		attachments: [attachment],
		clearAttachmentError: vi.fn(),
		clearAttachments: chatMocks.clearAttachments,
		handleFilesAdded: vi.fn(),
		handleFilesRejected: vi.fn(),
		hasFailedAttachments: false,
		isReadingAttachments: false,
		removeAttachment: chatMocks.removeAttachment,
		waitForAttachmentUploads: chatMocks.waitForAttachmentUploads,
	}),
}));

const ChatStateHarness = () => {
	const { attachments, handleInputChange, handleSubmit, input, removeAttachment } = useChatState();

	return (
		<form
			onSubmit={(event) => {
				handleSubmit(event);
			}}
		>
			<textarea aria-label='Message' onChange={handleInputChange} value={input} />
			{attachments.map((item) => (
				<div key={item.id}>
					<span>{item.filename}</span>
					<button onClick={() => removeAttachment(item.id)} type='button'>
						Remove
					</button>
				</div>
			))}
			<button type='submit'>Send</button>
		</form>
	);
};

describe("useChatState", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		chatMocks.sendMessage.mockResolvedValue(undefined);
	});

	it("clears the text as soon as the message is submitted and keeps attachments until the send is accepted", async () => {
		const send: SendResolverReference = {};
		chatMocks.waitForAttachmentUploads.mockResolvedValue([attachment]);
		chatMocks.sendMessage.mockReturnValue(
			new Promise<void>((resolve) => {
				send.resolve = resolve;
			})
		);
		const user = userEvent.setup();
		render(<ChatStateHarness />);

		await user.type(screen.getByRole("textbox", { name: "Message" }), "Send me now");
		await user.click(screen.getByRole("button", { name: "Send" }));

		expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("");
		await waitFor(() => expect(chatMocks.sendMessage).toHaveBeenCalledOnce());
		expect(screen.getByText("notes.txt")).toBeVisible();
		expect(chatMocks.clearAttachments).not.toHaveBeenCalled();

		send.resolve?.();
		await waitFor(() => expect(chatMocks.clearAttachments).toHaveBeenCalled());
	});

	it("restores the draft when an attachment upload fails", async () => {
		chatMocks.waitForAttachmentUploads.mockRejectedValue(new Error("Upload failed"));
		const user = userEvent.setup();
		render(<ChatStateHarness />);

		await user.type(screen.getByRole("textbox", { name: "Message" }), "Keep me");
		await user.click(screen.getByRole("button", { name: "Send" }));

		await waitFor(() => {
			expect(chatMocks.waitForAttachmentUploads).toHaveBeenCalledOnce();
		});
		expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("Keep me");
		expect(screen.getByText("notes.txt")).toBeVisible();
		expect(chatMocks.clearAttachments).not.toHaveBeenCalled();
		expect(chatMocks.sendMessage).not.toHaveBeenCalled();
	});

	it("clears the draft after attachment uploads succeed", async () => {
		chatMocks.waitForAttachmentUploads.mockResolvedValue([attachment]);
		const user = userEvent.setup();
		render(<ChatStateHarness />);

		await user.type(screen.getByRole("textbox", { name: "Message" }), "Send me");
		await user.click(screen.getByRole("button", { name: "Send" }));

		await waitFor(() => {
			expect(chatMocks.sendMessage).toHaveBeenCalledOnce();
		});
		expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("");
		expect(chatMocks.clearAttachments).toHaveBeenCalled();
	});

	it("restores the draft when the chat transport rejects the send", async () => {
		chatMocks.waitForAttachmentUploads.mockResolvedValue([attachment]);
		chatMocks.sendMessage.mockRejectedValue(new Error("Send failed"));
		const user = userEvent.setup();
		render(<ChatStateHarness />);

		await user.type(screen.getByRole("textbox", { name: "Message" }), "Try again");
		await user.click(screen.getByRole("button", { name: "Send" }));

		await waitFor(() => {
			expect(chatMocks.sendMessage).toHaveBeenCalledOnce();
		});
		expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("Try again");
		expect(screen.getByText("notes.txt")).toBeVisible();
		expect(chatMocks.clearAttachments).not.toHaveBeenCalled();
	});

	it("keeps a draft typed during a failed send instead of restoring the old one", async () => {
		const send: SendRejecterReference = {};
		chatMocks.waitForAttachmentUploads.mockResolvedValue([attachment]);
		chatMocks.sendMessage.mockReturnValue(
			new Promise<void>((_, reject) => {
				send.reject = reject;
			})
		);
		const user = userEvent.setup();
		render(<ChatStateHarness />);

		await user.type(screen.getByRole("textbox", { name: "Message" }), "First");
		await user.click(screen.getByRole("button", { name: "Send" }));
		await waitFor(() => expect(chatMocks.sendMessage).toHaveBeenCalledOnce());
		await user.type(screen.getByRole("textbox", { name: "Message" }), "Second");

		send.reject?.(new Error("Send failed"));
		await waitFor(() => expect(chatMocks.clearAttachments).not.toHaveBeenCalled());
		expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("Second");
	});

	it("keeps attachment actions locked until the chat transport accepts the send", async () => {
		const send: SendResolverReference = {};
		chatMocks.waitForAttachmentUploads.mockResolvedValue([attachment]);
		chatMocks.sendMessage.mockReturnValue(
			new Promise<void>((resolve) => {
				send.resolve = resolve;
			})
		);
		const user = userEvent.setup();
		render(<ChatStateHarness />);

		await user.click(screen.getByRole("button", { name: "Send" }));
		await waitFor(() => expect(chatMocks.sendMessage).toHaveBeenCalledOnce());
		await user.click(screen.getByRole("button", { name: "Remove" }));

		expect(chatMocks.removeAttachment).not.toHaveBeenCalled();
		send.resolve?.();
		await waitFor(() => expect(chatMocks.clearAttachments).toHaveBeenCalled());
	});

	it("does not remove the attachment snapshot while uploads are preparing", async () => {
		const uploads: UploadResolverReference = {};
		chatMocks.waitForAttachmentUploads.mockReturnValue(
			new Promise((resolve) => {
				uploads.resolve = resolve;
			})
		);
		const user = userEvent.setup();
		render(<ChatStateHarness />);

		await user.click(screen.getByRole("button", { name: "Send" }));
		await waitFor(() => expect(chatMocks.waitForAttachmentUploads).toHaveBeenCalledOnce());
		await user.click(screen.getByRole("button", { name: "Remove" }));

		expect(chatMocks.removeAttachment).not.toHaveBeenCalled();
		uploads.resolve?.([attachment]);
		await waitFor(() => expect(chatMocks.sendMessage).toHaveBeenCalledOnce());
	});
});

vi.mock("@/hooks/use-organization-permissions", () => ({
	useOrganizationPermissions: () => mockOrganizationPermissions(),
}));
