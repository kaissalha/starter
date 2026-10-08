import { render } from "react-email";
import { describe, expect, it } from "vitest";

import DomainAlertEmail from "../../src/emails/domain-alert";

describe("DomainAlertEmail", () => {
	it("renders an expiring domain with the days left", async () => {
		const html = await render(<DomainAlertEmail days={7} domain='studio.example' kind='expiring' />);

		expect(html).toContain("studio.example expires soon");
		expect(html).toContain("Days left: 7");
		expect(html).toContain("Manage domain");
	});

	it("renders a failed registration", async () => {
		const html = await render(<DomainAlertEmail domain='studio.example' kind='failed' />);

		expect(html).toContain("studio.example couldn&#x27;t be registered");
	});

	it("renders Arabic right-to-left with the domain interpolated", async () => {
		const html = await render(<DomainAlertEmail domain='studio.example' locale='ar' />);

		expect(html).toContain('dir="rtl"');
		expect(html).toContain("studio.example");
		expect(html).not.toContain("{domain}");
	});
});
