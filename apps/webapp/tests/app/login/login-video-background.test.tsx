import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginVideoBackground } from "@/app/[locale]/(auth)/login/components/login-video-background";

const mocks = vi.hoisted(() => ({ useBreakpoint: vi.fn() }));

vi.mock("@starter/ui/hooks/use-breakpoint", () => ({ useBreakpoint: mocks.useBreakpoint }));

describe("LoginVideoBackground", () => {
	beforeEach(() => vi.clearAllMocks());

	it("renders no media below the lg breakpoint", () => {
		mocks.useBreakpoint.mockReturnValue(false);
		const { container } = render(<LoginVideoBackground />);
		expect(mocks.useBreakpoint).toHaveBeenCalledWith("lg");
		expect(container.querySelector("video")).toBeNull();
		expect(container.querySelector("img")).toBeNull();
	});

	it("renders the autoplaying video at the lg breakpoint", () => {
		mocks.useBreakpoint.mockReturnValue(true);
		const { container } = render(<LoginVideoBackground />);
		expect(container.querySelector("video")?.hasAttribute("autoplay")).toBe(true);
	});
});
