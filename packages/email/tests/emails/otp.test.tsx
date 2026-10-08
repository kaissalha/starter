import { render } from "react-email";
import { describe, expect, it } from "vitest";

import OTPEmail from "../../src/emails/otp";

describe("OTPEmail", () => {
	it("renders the OTP code and translations", async () => {
		const html = await render(<OTPEmail otp='654321' />);

		expect(html).toContain("654321");
		expect(html).toContain("Your verification code");
	});

	it("falls back to English for unsupported locale", async () => {
		const html = await render(<OTPEmail locale='fr' otp='000000' />);

		expect(html).toContain("Your verification code");
	});

	it("renders Arabic right-to-left with the expiry in minutes", async () => {
		const html = await render(<OTPEmail expiresInMinutes={5} locale='ar' otp='654321' />);

		expect(html).toContain('lang="ar"');
		expect(html).toContain('dir="rtl"');
		expect(html).toContain("رمز التحقق الخاص بك");
		expect(html).toContain("بعد 5 دقائق");
		expect(html).toContain("654321");
	});

	it("states the configured expiry and stays left-to-right in English", async () => {
		const html = await render(<OTPEmail expiresInMinutes={7} />);

		expect(html).toContain('lang="en"');
		expect(html).toContain('dir="ltr"');
		expect(html).toContain("expire in 7 minutes");
	});
});
