// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContactForm } from "../src/contact/contact-form";
import { contactFormContent } from "../src/contact/contact-form-contracts";
import { Embed } from "../src/primitives/embed";
import fixtures from "../src/storybook/fixtures/sections/contact/contact-form.json";

afterEach(cleanup);

describe("contact form", () => {
	it("registers a generation-safe section with complete bilingual content", () => {
		expect(fixtures).toEqual({ ar: { copy: contactFormContent.ar }, en: { copy: contactFormContent.en } });
	});
	it("keeps preview forms disabled", () => {
		const submit = vi.fn();
		render(<ContactForm copy={contactFormContent.ar} preview sectionId='section' submit={submit} />);
		expect(screen.getByRole("group").hasAttribute("disabled")).toBe(true);
		fireEvent.submit(screen.getByRole("form"));
		expect(submit).not.toHaveBeenCalled();
	});
	it("retains input after failure, retries, announces success and clears the accepted message", async () => {
		const submit = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
		render(<ContactForm copy={contactFormContent.en} sectionId='section' submit={submit} />);
		fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada" } });
		fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
		fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Please send details." } });
		fireEvent.submit(screen.getByRole("form"));
		await screen.findByRole("alert");
		expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("Ada");
		fireEvent.submit(screen.getByRole("form"));
		await screen.findByText(contactFormContent.en.success);
		expect(submit).toHaveBeenLastCalledWith({
			email: "ada@example.com",
			message: "Please send details.",
			name: "Ada",
			phone: "",
			sectionId: "section",
		});
		fireEvent.click(screen.getByText(contactFormContent.en.anotherLabel));
		await waitFor(() => expect(screen.getByLabelText<HTMLInputElement>("Message").value).toBe(""));
	});
	it("renders the host form component for contact-form embeds and omits the phone field without a label", () => {
		const { phoneLabel: _phone, ...labels } = contactFormContent.en;
		const Host = vi.fn(() => <div data-testid='host-form' />);
		render(
			<Embed
				config={{ columns: 2, labels, submitWidth: "full" }}
				contactForm={{ component: Host, sectionId: "section-id" }}
				label='Contact'
				provider='contact-form'
			/>
		);
		expect(screen.getByTestId("host-form")).toBeTruthy();
		cleanup();
		render(<ContactForm columns={2} copy={labels} preview sectionId='section' />);
		expect(screen.queryByLabelText("Phone (optional)")).toBeNull();
		expect(screen.getByLabelText("Email")).toBeTruthy();
	});
});
