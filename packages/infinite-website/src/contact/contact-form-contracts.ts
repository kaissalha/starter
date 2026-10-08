import { z } from "zod";

export const contactFormCopySchema = z.strictObject({
	anotherLabel: z.string(),
	description: z.string(),
	emailLabel: z.string(),
	error: z.string(),
	heading: z.string(),
	messageLabel: z.string(),
	nameLabel: z.string(),
	pendingLabel: z.string(),
	phoneLabel: z.string(),
	preview: z.string(),
	submitLabel: z.string(),
	success: z.string(),
});

export type ContactFormCopy = z.infer<typeof contactFormCopySchema>;

type ContactFormLabels = Omit<ContactFormCopy, "description" | "heading" | "phoneLabel" | "preview"> & {
	heading?: string;
	phoneLabel?: string;
};

export type ContactFormSubmission = { email: string; message: string; name: string; phone: string; sectionId: string };

export type ContactFormProps = {
	columns?: 1 | 2;
	copy: ContactFormLabels;
	preview?: boolean;
	sectionId: string;
	submitWidth?: "fit" | "full";
};

export const contactFormContent = {
	ar: {
		anotherLabel: "إرسال رسالة أخرى",
		description: "أخبرنا بما يدور في بالك. أرسل لنا رسالة باستخدام النموذج.",
		emailLabel: "البريد الإلكتروني",
		error: "تعذّر إرسال رسالتك. يرجى المحاولة مرة أخرى.",
		heading: "لنتحدث",
		messageLabel: "الرسالة",
		nameLabel: "الاسم",
		pendingLabel: "جارٍ الإرسال…",
		phoneLabel: "رقم الهاتف (اختياري)",
		preview: "يمكن للزوار إرسال الرسائل من موقعك المنشور.",
		submitLabel: "إرسال الرسالة",
		success: "شكرًا لك. تم إرسال رسالتك.",
	},
	en: {
		anotherLabel: "Send another message",
		description: "Tell us what you have in mind. Send a message using the form.",
		emailLabel: "Email",
		error: "We couldn’t send your message. Please try again.",
		heading: "Let’s talk",
		messageLabel: "Message",
		nameLabel: "Name",
		pendingLabel: "Sending…",
		phoneLabel: "Phone (optional)",
		preview: "Visitors can send messages from your published website.",
		submitLabel: "Send message",
		success: "Thank you. Your message has been sent.",
	},
} satisfies Record<"en" | "ar", ContactFormCopy>;
