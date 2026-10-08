import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ error: vi.fn(), signOut: vi.fn() }));

vi.mock("@/lib/auth-client", () => ({ signOut: mocks.signOut }));

vi.mock("@starter/ui/components/toaster", () => ({ toast: { error: mocks.error } }));

import { useSignOut } from "@/hooks/use-sign-out";

import { mockUseRouter } from "../mocks/routing";

describe("sign out", () => {
	it.each([
		["redirects after", { error: null }, [["/login"]], []],
		["reports a response failure", { error: { message: "x" } }, [], [["messages.somethingWentWrong"]]],
		["reports a network failure", new Error("Offline"), [], [["messages.somethingWentWrong"]]],
	])("%s signing out", async (_name, outcome, pushes, errors) => {
		const push = vi.fn();
		mockUseRouter.mockReturnValue({ push, replace: vi.fn() });

		if (outcome instanceof Error) {
			mocks.signOut.mockRejectedValue(outcome);
		} else {
			mocks.signOut.mockResolvedValue(outcome);
		}

		const { result } = renderHook(useSignOut);
		await expect(result.current()).resolves.toBeUndefined();
		expect(push.mock.calls).toEqual(pushes);
		expect(mocks.error.mock.calls).toEqual(errors);
	});
});
