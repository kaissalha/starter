import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ContactsFilters } from "@/app/[locale]/dashboard/contacts/contacts-filters";

describe("contacts filters", () => {
	it("renders the shared filter trigger and exposes labeled filter controls", async () => {
		const user = userEvent.setup();
		const onToggle = vi.fn();
		render(
			<ContactsFilters
				filterCount={1}
				filters={{ contactMethod: ["email"] }}
				onClear={() => undefined}
				onToggle={onToggle}
			/>
		);

		const trigger = screen.getByRole("button", { name: "filters.triggerLabel" });

		await user.click(trigger);

		expect(await screen.findByText("filters.title")).toBeInTheDocument();
		const emailFilters = screen.getAllByRole("checkbox", { name: "email" });
		expect(emailFilters[0]).toHaveAttribute("data-checked", "");

		await user.click(screen.getAllByRole("checkbox", { name: "phone" })[0]);
		expect(onToggle).toHaveBeenCalledWith("contactMethod", "phone");
		await user.click(screen.getByRole("checkbox", { name: "triageCategories.booking" }));
		expect(onToggle).toHaveBeenCalledWith("triageCategory", "booking");
		await user.click(screen.getByRole("checkbox", { name: "filters.onlySpam" }));
		expect(onToggle).toHaveBeenCalledWith("spam", "only");
	});
});
