import { render } from "react-email";
import { describe, expect, it } from "vitest";

import ContactMessageEmail from "../../src/emails/contact-message";

describe("ContactMessageEmail", () => {
	it("renders the sender, contact details, message and links", async () => {
		const html = await render(
			<ContactMessageEmail
				contactLink='https://app.example.com/dashboard/contacts?contact=1'
				message='Do you cater weddings?'
				senderEmail='grace@example.com'
				senderName='Grace Hopper'
				senderPhone='+1 555 0100'
				settingsLink='https://app.example.com/dashboard?settings=notifications'
			/>
		);

		expect(html).toContain("Grace Hopper");
		expect(html).toContain("grace@example.com");
		expect(html).toContain("+1 555 0100");
		expect(html).toContain("Do you cater weddings?");
		expect(html).toContain('href="https://app.example.com/dashboard/contacts?contact=1"');
		expect(html).toContain('href="https://app.example.com/dashboard?settings=notifications"');
	});

	it("escapes visitor markup", async () => {
		const html = await render(<ContactMessageEmail message='<script>alert(1)</script>' />);

		expect(html).toContain("&lt;script&gt;");
		expect(html).not.toContain("<script>alert");
	});

	it("keeps message line breaks as text", async () => {
		const html = await render(<ContactMessageEmail message={"First line\nSecond line"} />);

		expect(html).toContain("First line");
		expect(html).toContain("Second line");
		expect(html).toContain("white-space:pre-wrap");
		expect(html).not.toContain("&lt;br");
	});

	it("renders Arabic right-to-left", async () => {
		const html = await render(<ContactMessageEmail locale='ar' />);

		expect(html).toContain('dir="rtl"');
		expect(html).toContain("عرض الرسالة");
	});

	it("omits the phone row without a phone number", async () => {
		const html = await render(<ContactMessageEmail senderPhone={null} />);

		expect(html).not.toContain("Phone");
	});
});
