import { expect, test } from "@playwright/test";

import { expectInViewport, expectNoHorizontalOverflow } from "../fixtures/mobile";
import { resetWorkspaceRecords } from "../fixtures/workspace";

test.beforeEach(async () => {
	await resetWorkspaceRecords();
});

test("adds, edits, searches, and deletes a contact on a phone", async ({ page }) => {
	await page.goto("/dashboard/contacts");
	await page.getByRole("button", { exact: true, name: "New" }).tap();
	const form = page.getByRole("dialog");
	await form.getByRole("textbox", { exact: true, name: "Name" }).fill("Maya Lind");
	await form.getByRole("textbox", { exact: true, name: "Email" }).fill("maya@example.com");
	const phone = form.getByRole("textbox", { exact: true, name: "Phone" });
	await expect(phone).toHaveAttribute("type", "tel");
	await phone.fill("+1 604 555 0101");
	const add = form.getByRole("button", { name: "Add contact" });
	await expectInViewport(add);
	await add.tap();

	const details = page.getByRole("dialog", { name: "Maya Lind" });
	await expect(details.getByRole("tab", { name: "Details" })).toBeVisible();
	await details.getByRole("textbox", { exact: true, name: "Name" }).fill("Maya Lindqvist");
	const save = details.getByRole("button", { name: "Save changes" });
	await expectInViewport(save);
	await save.tap();
	await expect(page.getByRole("dialog", { name: "Maya Lindqvist" })).toBeVisible();
	await page.keyboard.press("Escape");

	const row = page.getByRole("row").filter({ hasText: "Maya Lindqvist" });
	await expect(row).toContainText("maya@example.com");
	await expectNoHorizontalOverflow(page);

	await page.getByRole("button", { name: "Search contacts…" }).tap();
	await page.getByRole("textbox", { name: "Search contacts…" }).fill("nobody");
	await expect(page.getByText("No contacts found")).toBeVisible();
	await page.getByRole("button", { name: "Back" }).tap();

	await page.getByRole("row").filter({ hasText: "Maya Lindqvist" }).tap();
	await page.getByRole("button", { name: "Contact actions" }).tap();
	await page.getByRole("menuitem", { name: "Delete contact" }).tap();
	await page.getByRole("alertdialog").getByRole("button", { name: "Delete contact" }).tap();
	await expect(page.getByText("You don't have any contacts, yet.")).toBeVisible();
});
