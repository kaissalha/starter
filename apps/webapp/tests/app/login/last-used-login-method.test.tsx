import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
	useTranslations: () => (key: string) => (key === "lastUsed" ? "Last used" : key),
}));

import { LastUsedLoginMethod } from "@/app/[locale]/(auth)/login/components/last-used-login-method";

describe("last used login method", () => {
	it("shows the badge only for the matching method", () => {
		const { rerender } = render(<LastUsedLoginMethod activeMethod='google' method='google' />);

		expect(screen.getByText("Last used")).toBeVisible();
		expect(screen.getByText("Last used")).toHaveAttribute("aria-hidden", "false");

		rerender(<LastUsedLoginMethod activeMethod='google' method='email' />);

		expect(screen.getByText("Last used")).toHaveClass("invisible");
		expect(screen.getByText("Last used")).toHaveAttribute("aria-hidden", "true");
	});
});
