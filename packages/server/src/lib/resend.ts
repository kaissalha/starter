import { Resend } from "resend";

type EmailFlow = "email-otp" | "notification" | "organization-invitation";

export const resend = new Resend(process.env.RESEND_KEY);

const resolveSender = () => {
	const configuredSender = process.env.EMAIL_FROM?.trim();

	if (configuredSender) {
		return configuredSender;
	}

	if (process.env.NODE_ENV === "production") {
		throw new Error("EMAIL_FROM is required in production");
	}

	return "starter <onboarding@resend.dev>";
};

export const sendEmail = async ({
	flow,
	html,
	idempotencyKey,
	replyTo,
	subject,
	to,
}: {
	flow: EmailFlow;
	html: string;
	idempotencyKey?: string;
	replyTo?: string;
	subject: string;
	to: string;
}) => {
	const { data, error } = await resend.emails.send(
		{ from: resolveSender(), html, replyTo, subject, to: [to] },
		{ idempotencyKey }
	);

	if (error) {
		throw new Error(`Failed to send ${flow} email: ${error.name}: ${error.message}`);
	}

	return data.id;
};
