import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	process.env.REDIS_URL = "redis://127.0.0.1:6399";

	return { check: vi.fn(), send: vi.fn() };
});

vi.mock("@starter/email", () => ({ InvitationEmail: vi.fn(), OTPEmail: vi.fn() }));

vi.mock("react-email", () => ({ render: vi.fn().mockResolvedValue("OTP email") }));

vi.mock("../../src/lib/resend", () => ({ resend: { emails: { send: mocks.send } } }));

vi.mock("../../src/lib/redis", () => ({ checkRateLimit: mocks.check }));

import { auth } from "../../src/lib/auth";

const send = (email: string) =>
	auth.api.sendVerificationOTP({ body: { email, type: "sign-in" }, headers: new Headers() });

describe("auth rate limits", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.send.mockResolvedValue({ error: null });
		mocks.check.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
	});

	afterAll(() => {
		delete process.env.REDIS_URL;
	});

	it("shares Better Auth rule decisions through Redis", async () => {
		const storage = auth.options.rateLimit.customStorage;

		await expect(storage?.consume("1.2.3.4|/sign-in/email-otp", { max: 3, window: 60 })).resolves.toEqual({
			allowed: true,
			retryAfter: null,
		});
		expect(mocks.check).toHaveBeenCalledWith({ key: "auth:1.2.3.4|/sign-in/email-otp", max: 3, windowSeconds: 60 });

		mocks.check.mockResolvedValue({ allowed: false, retryAfterSeconds: 41 });
		await expect(storage?.consume("1.2.3.4|/sign-in/email-otp", { max: 3, window: 60 })).resolves.toEqual({
			allowed: false,
			retryAfter: 41,
		});
	});

	it("keys the OTP send limit on the normalized address", async () => {
		await expect(send("Ada@Example.com")).resolves.toEqual({ success: true });
		await send("ada@example.com");

		const [first, second] = mocks.check.mock.calls.map(([options]) => options);
		expect(first?.key).toMatch(/^auth:email-otp:[a-f0-9]{64}$/u);
		expect(second?.key).toBe(first?.key);
		expect(mocks.check.mock.calls.every(([{ max, windowSeconds }]) => max === 5 && windowSeconds === 900)).toBe(
			true
		);
	});

	it("rejects with TOO_MANY_REQUESTS before any email is sent", async () => {
		mocks.check.mockResolvedValue({ allowed: false, retryAfterSeconds: 42 });

		await expect(send("ada@example.com")).rejects.toMatchObject({ status: "TOO_MANY_REQUESTS" });
		expect(mocks.send).not.toHaveBeenCalled();
	});

	it("leaves unrelated auth calls alone", async () => {
		await auth.api.getSession({ headers: new Headers() });

		expect(mocks.check).not.toHaveBeenCalled();
	});
});
