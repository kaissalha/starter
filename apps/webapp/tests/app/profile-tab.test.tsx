import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileTab } from "@/app/[locale]/dashboard/components/settings/profile-tab";

const mocks = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), updateUser: vi.fn() }));

vi.mock("@/lib/auth-client", () => ({ authClient: { updateUser: mocks.updateUser } }));

vi.mock("@starter/ui/components/toaster", () => ({ toast: { error: mocks.error, success: mocks.success } }));

vi.mock("@/components/auth/auth-session-context", () => ({
	useAuthSession: () => ({ data: { user: { email: "user@example.com", image: null, name: "Original name" } } }),
}));

describe("profile settings", () => {
	beforeEach(() => vi.clearAllMocks());

	it.each(["response", "network"])(
		"reports a %s failure without showing success and allows retry",
		async (failure) => {
			if (failure === "response") {
				mocks.updateUser.mockResolvedValue({ error: { message: "Rejected" } });
			} else {
				mocks.updateUser.mockRejectedValue(new Error("Offline"));
			}

			render(<ProfileTab />);
			fireEvent.change(screen.getByRole("textbox", { name: "profile.fields.name" }), {
				target: { value: " Updated name " },
			});
			fireEvent.click(screen.getByRole("button", { name: "save" }));
			await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("saveError"));
			expect(mocks.success).not.toHaveBeenCalled();
			expect(screen.getByRole("button", { name: "save" })).toBeEnabled();
			expect(screen.getByRole("textbox", { name: "profile.fields.name" })).toHaveValue(" Updated name ");
			mocks.updateUser.mockResolvedValue({ error: null });
			fireEvent.click(screen.getByRole("button", { name: "save" }));
			await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("saved"));
			expect(mocks.updateUser).toHaveBeenLastCalledWith({ name: "Updated name" });
		}
	);

	it("keeps email readable and blocks empty, unchanged, or overlong names", () => {
		render(<ProfileTab />);
		expect(screen.getByRole("textbox", { name: "profile.fields.email" })).toHaveAttribute("readonly");
		const input = screen.getByRole("textbox", { name: "profile.fields.name" });
		expect(input).toHaveAttribute("maxlength", "32");

		for (const value of ["", " Original name ", "a".repeat(33)]) {
			fireEvent.change(input, { target: { value } });
			expect(screen.getByRole("button", { name: "save" })).toBeDisabled();
		}

		expect(mocks.updateUser).not.toHaveBeenCalled();
	});
});
