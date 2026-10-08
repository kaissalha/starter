import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
	useTranslations: () => (key: string, values?: Record<string, string>) =>
		values ? `${key}:${Object.values(values).join(",")}` : key,
}));

import { CreateOrganizationForm } from "@/app/[locale]/onboarding/components/create-organization-form";
import { useCreateOrganizationForm } from "@/app/[locale]/onboarding/components/use-create-organization-form";

describe("organization onboarding", () => {
	it("keeps the name visible while creating", () => {
		render(<CreateOrganizationForm isCreating onCreate={vi.fn()} />);
		expect(screen.getByRole("textbox")).toBeVisible();
		expect(screen.getByRole("textbox")).toBeDisabled();
		expect(screen.getByRole("button", { name: "createAction" })).toHaveAttribute("aria-busy", "true");
	});

	it("requires a name and submits it trimmed", async () => {
		const onCreate = vi.fn().mockResolvedValue(null);
		render(<CreateOrganizationForm isCreating={false} onCreate={onCreate} />);
		expect(screen.getByRole("button", { name: "createAction" })).toBeDisabled();
		fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
		expect(screen.getByRole("button", { name: "createAction" })).toBeDisabled();
		fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Acme Inc  " } });
		await userEvent.click(screen.getByRole("button", { name: "createAction" }));
		await waitFor(() => expect(onCreate).toHaveBeenCalledWith("Acme Inc"));
	});

	it("keeps the name and shows setup failures for retry", async () => {
		const { result } = renderHook(() =>
			useCreateOrganizationForm({ onCreate: vi.fn().mockResolvedValue("Try again") })
		);

		act(() => {
			result.current.form.setValue("name", "Acme");
		});
		expect(result.current.form.formState.errors.root).toBeUndefined();
		await act(async () => {
			await result.current.handleSubmit();
		});

		expect(result.current.form.formState.errors.root?.message).toBe("Try again");
		expect(result.current.form.getValues()).toEqual({ name: "Acme" });
	});
});
