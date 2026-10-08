import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
	useTranslations: () => (key: string, values?: Record<string, string>) =>
		values ? `${key}:${Object.values(values).join(",")}` : key,
}));

import { HeroPrompt } from "@/app/[locale]/(site)/components/sections/hero-prompt";
import { CreateOrganizationForm } from "@/app/[locale]/onboarding/components/create-organization-form";
import { useCreateOrganizationForm } from "@/app/[locale]/onboarding/components/use-create-organization-form";

import { mockUseRouter } from "../../mocks/routing";

const advance = async () => {
	await userEvent.click(screen.getByRole("button", { name: "next" }));
};

describe("business onboarding", () => {
	beforeEach(() => sessionStorage.clear());

	it("carries the landing hero prompt into the business type once", async () => {
		const push = vi.fn();
		mockUseRouter.mockReturnValue({ push, replace: vi.fn() });
		render(<HeroPrompt cta='go' label='Describe' sentences={["A bakery"]} />);
		fireEvent.change(screen.getByRole("textbox", { name: "Describe" }), {
			target: { value: ` Family bakery in Amman ${"x".repeat(120)}` },
		});
		await userEvent.click(screen.getByRole("button", { name: "go" }));
		expect(push).toHaveBeenCalledWith("/dashboard/website");
		const { result } = renderHook(() => useCreateOrganizationForm({ onCreate: vi.fn() }));
		expect(result.current.form.getValues("type")).toBe(`Family bakery in Amman ${"x".repeat(97)}`);
		expect(sessionStorage.getItem("hero-prompt-draft")).toBeNull();
	});

	it("keeps an existing business type over the hero prompt", () => {
		sessionStorage.setItem("hero-prompt-draft", "Family bakery");
		const initialBusiness = { location: "Amman", name: "Acme", type: "Design studio" };
		const { result } = renderHook(() => useCreateOrganizationForm({ initialBusiness, onCreate: vi.fn() }));
		expect(result.current.form.getValues("type")).toBe("Design studio");
	});

	it("keeps the details visible while handing off to the website", () => {
		render(<CreateOrganizationForm isCreating onCreate={vi.fn()} />);
		expect(screen.getByRole("textbox")).toBeVisible();
		expect(screen.getByRole("textbox")).toBeDisabled();
		expect(screen.getByRole("button", { name: "next" })).toHaveAttribute("aria-busy", "true");
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
	});

	it("validates each step, keeps raw input when going back, and submits the complete trimmed brief", async () => {
		const onCreate = vi.fn().mockResolvedValue(null);
		render(<CreateOrganizationForm isCreating={false} onCreate={onCreate} />);
		expect(screen.getByRole("button", { name: "next" })).toBeDisabled();
		fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
		expect(screen.getByRole("button", { name: "next" })).toBeDisabled();
		fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Acme Inc  " } });
		await advance();
		await screen.findByRole("textbox", { name: "fields.location.label" });
		expect(screen.getByRole("button", { name: "next" })).toBeDisabled();
		fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Toronto  " } });
		await userEvent.click(screen.getByRole("button", { name: "back" }));
		expect(await screen.findByRole("textbox", { name: "fields.name.label" })).toHaveValue("  Acme Inc  ");
		await advance();
		expect(await screen.findByRole("textbox", { name: "fields.location.label" })).toHaveValue("  Toronto  ");
		await advance();
		await screen.findByRole("textbox", { name: "fields.type.label" });
		expect(screen.getByRole("button", { name: "createAction" })).toBeDisabled();
		expect(onCreate).not.toHaveBeenCalled();
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
		fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Design studio  " } });
		await userEvent.click(screen.getByRole("button", { name: "createAction" }));
		await waitFor(() =>
			expect(onCreate).toHaveBeenCalledWith({ location: "Toronto", name: "Acme Inc", type: "Design studio" })
		);
	});

	it("keeps all answers and shows setup failures for retry", async () => {
		const { result } = renderHook(() =>
			useCreateOrganizationForm({ onCreate: vi.fn().mockResolvedValue("Try again") })
		);

		act(() => {
			result.current.form.setValue("name", "Acme");
			result.current.form.setValue("location", "Toronto");
			result.current.form.setValue("type", "Design studio");
		});
		expect(result.current.form.formState.errors.root).toBeUndefined();

		for (const step of [0, 1, 2]) {
			expect(result.current.step).toBe(step);
			await act(async () => {
				await result.current.handleSubmit();
			});
		}

		expect(result.current.form.formState.errors.root?.message).toBe("Try again");
		expect(result.current.form.getValues()).toEqual({ location: "Toronto", name: "Acme", type: "Design studio" });
	});
});
