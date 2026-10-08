import { useState } from "react";

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DashboardChatUIMessage as BaseChatUIMessage } from "@starter/server";

import { type UseAutoResumeParams, useAutoResume } from "../../src/components/chat/stores/use-auto-resume";

const createTextMessage = ({
	id,
	role,
	text,
}: {
	id: string;
	role: "user" | "assistant";
	text: string;
}): BaseChatUIMessage => {
	return {
		id,
		parts: [{ text, type: "text" }],
		role,
	};
};

describe("useAutoResume", () => {
	it("resumes when the most recent initial message is from the user", async () => {
		const resumeStream = vi.fn();
		const initialMessages = [createTextMessage({ id: "user-1", role: "user", text: "Hello" })];

		renderHook(() => {
			const [, setMessages] = useState(initialMessages);

			useAutoResume({
				autoResume: true,
				data: [],
				initialMessages,
				resumeStream,
				setMessages,
			});
		});

		await waitFor(() => {
			expect(resumeStream).toHaveBeenCalledTimes(1);
		});
	});

	it("appends resumable messages idempotently", async () => {
		const initialMessages = [createTextMessage({ id: "user-1", role: "user", text: "Hello" })];
		const appendedMessage = createTextMessage({ id: "assistant-1", role: "assistant", text: "Hi there" });
		const initialData: UseAutoResumeParams["data"] = [];

		const { rerender, result } = renderHook(
			({ data }: { data: UseAutoResumeParams["data"] }) => {
				const [messages, setMessages] = useState(initialMessages);

				useAutoResume({
					autoResume: false,
					data,
					initialMessages,
					resumeStream: vi.fn(),
					setMessages,
				});

				return messages;
			},
			{
				initialProps: {
					data: initialData,
				},
			}
		);

		rerender({
			data: [{ data: JSON.stringify(appendedMessage), type: "data-append-message" }],
		});

		await waitFor(() => {
			expect(result.current).toHaveLength(2);
		});

		rerender({
			data: [{ data: JSON.stringify(appendedMessage), type: "data-append-message" }],
		});

		await waitFor(() => {
			expect(result.current).toHaveLength(2);
			expect(result.current[1]?.id).toBe(appendedMessage.id);
		});
	});
});
