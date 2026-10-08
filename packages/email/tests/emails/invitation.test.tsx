import { render } from "react-email";
import { describe, expect, it } from "vitest";

import InvitationEmail from "../../src/emails/invitation";

describe("InvitationEmail", () => {
	it("renders the organization, inviter and link in English", async () => {
		const html = await render(
			<InvitationEmail
				inviteLink='https://app.example.com/accept-invitation/invitation-1'
				inviterName='Jane Doe'
				organizationName='Studio Co'
			/>
		);

		expect(html).toContain("Studio Co");
		expect(html).toContain("Jane Doe");
		expect(html).toContain("https://app.example.com/accept-invitation/invitation-1");
		expect(html).toContain("Accept invitation");
	});

	it("renders Arabic right-to-left with a localized role", async () => {
		const html = await render(<InvitationEmail locale='ar' role='admin' />);

		expect(html).toContain('dir="rtl"');
		expect(html).toContain("قبول الدعوة");
		expect(html).toContain("بصفة مسؤول");
	});

	it("renders an unknown role as given", async () => {
		const html = await render(<InvitationEmail role='billing' />);

		expect(html).toContain("as a billing");
	});
});
