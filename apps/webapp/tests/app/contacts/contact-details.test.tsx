import { QueryClient, QueryClientProvider, type MutationOptions } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ContactDetails } from "@/app/[locale]/dashboard/contacts/contact-details";
import type { ContactRow } from "@/app/[locale]/dashboard/contacts/use-contacts-controller";
import { Drawer, DrawerPopup, DrawerTitle } from "@starter/ui/components/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@starter/ui/components/tabs";

import { mockOrganizationPermissions, organizationPermissionState } from "../../mocks/organization-permissions";

type UpdateInput = { contactId: string; email: string | null; name: string | null; phone: string | null };

const mocks = vi.hoisted(() => ({
	remove: vi.fn<(input: { contactId: string }) => Promise<{ id: string }>>(),
	update: vi.fn<(input: UpdateInput) => Promise<ContactRow>>(),
}));

vi.mock("@/lib/api-client", () => ({
	apiClient: {
		contacts: {
			delete: {
				mutationOptions: (options: MutationOptions<{ id: string }, Error, { contactId: string }>) => ({
					...options,
					mutationFn: mocks.remove,
				}),
			},
			get: { queryKey: ({ input }: { input: { contactId: string } }) => ["contacts", "get", input.contactId] },
			list: { key: () => ["contacts", "list"] },
			update: {
				mutationOptions: (options: MutationOptions<ContactRow, Error, UpdateInput>) => ({
					...options,
					mutationFn: mocks.update,
				}),
			},
		},
	},
}));

const contact: ContactRow = {
	createdAt: "2026-09-01T12:00:00Z",
	email: "ada@example.com",
	id: "4cdeb4a4-0455-46de-9526-d22d4b73e9b3",
	name: "Ada",
	phone: null,
};

const renderDetails = () => {
	const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
	queryClient.setQueryData(["contacts", "get", contact.id], contact);
	const onDeleted = vi.fn();
	render(
		<NextIntlClientProvider locale='en' messages={{}} timeZone='UTC'>
			<QueryClientProvider client={queryClient}>
				<Drawer open>
					<DrawerPopup>
						<DrawerTitle>Contact</DrawerTitle>
						<Tabs defaultValue='details'>
							<TabsList>
								<TabsTrigger value='details'>Details</TabsTrigger>
								<TabsTrigger value='activity'>Activity</TabsTrigger>
							</TabsList>
							<TabsContent keepMounted value='details'>
								<ContactDetails contact={contact} onDeleted={onDeleted} />
							</TabsContent>
							<TabsContent value='activity'>Created</TabsContent>
						</Tabs>
					</DrawerPopup>
				</Drawer>
			</QueryClientProvider>
		</NextIntlClientProvider>
	);

	return { onDeleted, queryClient, user: userEvent.setup() };
};

describe("editable contact details", () => {
	it("renders member details as read-only without mutation actions", async () => {
		organizationPermissionState.role = "member";
		const { user } = renderDetails();
		const name = await screen.findByRole("textbox", { name: "name" });
		expect(name).toHaveAttribute("readonly");
		await user.type(name, " Changed");
		expect(name).toHaveValue("Ada");
		expect(screen.queryByRole("button", { name: "actions" })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "save" })).not.toBeInTheDocument();
		expect(mocks.update).not.toHaveBeenCalled();
	});
	it("allows admin edits without exposing deletion", async () => {
		organizationPermissionState.role = "admin";
		const { user } = renderDetails();
		const name = await screen.findByRole("textbox", { name: "name" });
		await user.type(name, " Lovelace");
		expect(screen.getByRole("button", { name: "save" })).toBeEnabled();
		expect(screen.queryByRole("button", { name: "actions" })).not.toBeInTheDocument();
	});
	beforeEach(() => {
		mocks.update.mockReset();
		mocks.remove.mockReset();
	});
	it("keeps typing local, cancels changes, and saves normalized fields to the cache", async () => {
		const { queryClient, user } = renderDetails();
		const name = await screen.findByRole("textbox", { name: "name" });
		await user.clear(name);
		await user.type(name, " Grace ");
		expect(name).toHaveValue(" Grace ");
		await user.click(screen.getByRole("tab", { name: "Activity" }));
		await waitFor(() => expect(name).not.toBeVisible());
		await user.click(screen.getByRole("tab", { name: "Details" }));
		expect(name).toHaveValue(" Grace ");
		expect(mocks.update).not.toHaveBeenCalled();
		await user.click(screen.getByRole("button", { name: "cancel" }));
		expect(name).toHaveValue("Ada");
		await user.clear(name);
		await user.type(name, " Grace ");
		mocks.update.mockResolvedValue({ ...contact, name: "Grace" });
		await user.click(screen.getByRole("button", { name: "save" }));
		await waitFor(() =>
			expect(queryClient.getQueryData(["contacts", "get", contact.id])).toEqual({ ...contact, name: "Grace" })
		);
		expect(mocks.update.mock.calls[0]?.[0]).toEqual({
			contactId: contact.id,
			email: contact.email,
			name: "Grace",
			phone: null,
		});
	});
	it("preserves edits after a failed save and allows retry", async () => {
		const { user } = renderDetails();
		const name = await screen.findByRole("textbox", { name: "name" });
		await user.type(name, " Lovelace");
		mocks.update.mockRejectedValue(new Error("Conflict"));
		await user.click(screen.getByRole("button", { name: "save" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("updateFailed");
		expect(name).toHaveValue("Ada Lovelace");
		expect(screen.getByRole("button", { name: "save" })).toBeEnabled();
	});
	it("requires confirmation before deleting and clears the deleted contact cache", async () => {
		const { onDeleted, queryClient, user } = renderDetails();
		await user.click(await screen.findByRole("button", { name: "actions" }));
		await user.click(await screen.findByRole("menuitem", { name: "deleteContact" }));
		const dialog = await screen.findByRole("alertdialog");
		expect(mocks.remove).not.toHaveBeenCalled();
		await user.click(within(dialog).getByRole("button", { name: "cancel" }));
		expect(mocks.remove).not.toHaveBeenCalled();
		await user.click(screen.getByRole("button", { name: "actions" }));
		await user.click(await screen.findByRole("menuitem", { name: "deleteContact" }));
		mocks.remove.mockResolvedValue({ id: contact.id });
		await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "deleteContact" }));
		await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
		expect(queryClient.getQueryData(["contacts", "get", contact.id])).toBeUndefined();
	});
});

vi.mock("@/hooks/use-organization-permissions", () => ({
	useOrganizationPermissions: () => mockOrganizationPermissions(),
}));
