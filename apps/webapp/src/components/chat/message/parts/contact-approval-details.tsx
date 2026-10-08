"use client";

import { useTranslations } from "next-intl";
import { z } from "zod";

import { useChatSession } from "@/components/chat/stores/chat-session-store";

const contactDetailsSchema = z.compile(
	z.looseObject({
		email: z.string().nullable(),
		id: z.string().optional(),
		name: z.string().nullable(),
		phone: z.string().nullable(),
	})
);

const contactTargetSchema = z.compile(z.looseObject({ contactId: z.string() }));

export const ContactApprovalDetails = ({ input, toolName }: { input?: unknown; toolName: string }) => {
	const t = useTranslations("components.chat.message.tool.approval.contactFields");
	const messages = useChatSession((state) => state.messages);
	const target = contactTargetSchema.safeParse(input);

	const inspected = messages
		.flatMap((message) => message.parts)
		.findLast(
			(part) =>
				part.type === "tool-getContact" &&
				part.state === "output-available" &&
				target.success &&
				contactDetailsSchema.safeParse(part.output).data?.id === target.data.contactId
		);

	const details = contactDetailsSchema.safeParse(
		toolName === "deleteContact" && inspected?.type === "tool-getContact" ? inspected.output : input
	);

	if (!details.success) {
		return null;
	}

	return (
		<dl className='mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-background/64 p-3 text-sm'>
			{(["name", "email", "phone"] as const).map((field) => (
				<div className='contents' key={field}>
					<dt className='text-muted-foreground'>{t(field)}</dt>
					<dd className='min-w-0 break-words'>{details.data[field] || "—"}</dd>
				</div>
			))}
		</dl>
	);
};
