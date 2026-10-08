import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OrganizationLogoUpload } from "@/app/[locale]/dashboard/components/settings/organization-logo-upload";
import { useOrganizationSettingsForm } from "@/app/[locale]/dashboard/components/settings/use-organization-settings-form";

const mocks = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), update: vi.fn() }));

vi.mock("@/lib/auth-client", () => ({
	authClient: { organization: { update: mocks.update }, useActiveOrganization: () => ({ refetch: vi.fn() }) },
}));

vi.mock("@/components/media/media-picker", () => ({ MediaPickerContent: () => null }));

vi.mock("@starter/ui/components/toaster", () => ({ toast: { error: mocks.error, success: mocks.success } }));

const organization = { id: "org", logo: "https://example.com/logo.png", name: "Acme" };

describe("organization settings", () => {
	it.each([
		["a network failure", () => mocks.update.mockRejectedValue(new Error("Offline")), "error", "saveError"],
		["a success", () => mocks.update.mockResolvedValue({ error: null }), "success", "saved"],
		[
			"a forbidden response",
			() =>
				mocks.update.mockResolvedValue({
					error: { code: "YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION" },
				}),
			"error",
			"messages.forbidden",
		],
	] as const)("ends saving after %s", async (_name, arrange, toastType, message) => {
		arrange();
		const { result } = renderHook(() => useOrganizationSettingsForm({ canEdit: true, organization }));
		act(() => result.current.setName("Acme 2"));
		await act(() => result.current.handleSave());
		expect(result.current.isSaving).toBe(false);
		expect(mocks[toastType]).toHaveBeenCalledWith(message);
		expect(mocks[toastType === "error" ? "success" : "error"]).not.toHaveBeenCalled();
	});

	it("ends saving when removing the logo fails on the network", async () => {
		mocks.update.mockReset().mockRejectedValue(new Error("Offline"));
		mocks.success.mockReset();
		render(<OrganizationLogoUpload canEdit organization={organization} />);
		fireEvent.click(screen.getByRole("button", { name: "delete" }));
		await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("failed"));
		expect(mocks.update).toHaveBeenCalledWith({ data: { logo: "" }, organizationId: "org" });
		await waitFor(() => expect(screen.getByRole("button", { name: "delete" })).toBeEnabled());
		expect(mocks.success).not.toHaveBeenCalled();
	});
});
