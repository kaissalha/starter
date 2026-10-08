import { render } from "react-email";
import { describe, expect, it } from "vitest";

import WelcomeEmail from "../../src/emails/welcome";

describe("WelcomeEmail", () => {
	it("renders the greeting and support text", async () => {
		const html = await render(<WelcomeEmail fullName='Ada Lovelace' />);

		expect(html).toContain("Ada");
		expect(html).toContain("Welcome to starter");
	});
});
