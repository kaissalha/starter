import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("resend", () => ({
	Resend: class {
		emails = { send: mocks.send };
	},
}));

import { sendEmail } from "../../src/lib/resend";

const message = {
	flow: "email-otp",
	html: "<p>code</p>",
	subject: "Your verification code",
	to: "person@example.com",
} as const;

describe("sendEmail", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.stubEnv("NODE_ENV", "test");
		vi.stubEnv("EMAIL_FROM", "Studio <no-reply@mail.example.com>");
		mocks.send.mockResolvedValue({ data: { id: "email-1" }, error: null });
	});
	afterEach(() => vi.unstubAllEnvs());

	it.each(["test", "production"])("sends from the configured sender when NODE_ENV is %s", async (environment) => {
		vi.stubEnv("NODE_ENV", environment);
		vi.stubEnv("EMAIL_FROM", "  Studio <no-reply@mail.example.com>  ");
		await sendEmail(message);
		expect(mocks.send).toHaveBeenCalledWith(
			{
				from: "Studio <no-reply@mail.example.com>",
				html: message.html,
				subject: message.subject,
				to: [message.to],
			},
			{ idempotencyKey: undefined }
		);
	});

	it("falls back to the Resend sandbox sender outside production", async () => {
		vi.stubEnv("EMAIL_FROM", "");
		await sendEmail(message);
		expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ from: "starter <onboarding@resend.dev>" }), {
			idempotencyKey: undefined,
		});
	});

	it("refuses to send in production without EMAIL_FROM", async () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("EMAIL_FROM", "");
		await expect(sendEmail(message)).rejects.toThrow("EMAIL_FROM is required in production");
		expect(mocks.send).not.toHaveBeenCalled();
	});

	it("throws provider failures without exposing the recipient", async () => {
		mocks.send.mockResolvedValue({
			data: null,
			error: { message: "The domain is not verified", name: "validation_error", statusCode: 403 },
		});
		await expect(sendEmail(message)).rejects.toThrow(
			"Failed to send email-otp email: validation_error: The domain is not verified"
		);
		await expect(sendEmail(message)).rejects.not.toThrow(message.to);
	});
});
