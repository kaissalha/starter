import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrganizationMembers } from "@/app/[locale]/dashboard/components/settings/organization-members";

import { mockOrganizationPermissions, organizationPermissionState } from "../mocks/organization-permissions";

const team = vi.hoisted(() => ({ organizationId: "organization" }));

const auth = vi.hoisted(() => ({
	cancelInvitation: vi.fn(),
	inviteMember: vi.fn(),
	listInvitations: vi.fn(),
	listMembers: vi.fn(),
	removeMember: vi.fn(),
	updateMemberRole: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: { organization: auth },
}));

vi.mock("@/app/[locale]/dashboard/components/settings/profile-tab", () => ({ ProfileTab: () => null }));

vi.mock("@/app/[locale]/dashboard/components/settings/organization-tab", () => ({ OrganizationTab: () => null }));

vi.mock("@/app/[locale]/dashboard/components/settings/developers-tab", () => ({ DevelopersTab: () => null }));

vi.mock("@/hooks/use-organization-permissions", () => ({
	useOrganizationPermissions: () => ({
		...mockOrganizationPermissions(),
		organizationId: team.organizationId,
		userId: "owner-user",
	}),
}));

const invitation = {
	createdAt: "2026-01-01T00:00:00Z",
	email: "invited@example.com",
	expiresAt: "2099-01-01T00:00:00Z",
	id: "invitation-id",
	role: "member",
	status: "pending",
};

const renderMembers = (ui = <OrganizationMembers />) => {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

	const wrapper = ({ children }: { children: React.ReactNode }) => (
		<NextIntlClientProvider locale='en' messages={{}} now={new Date("2026-09-08T12:00:00Z")}>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</NextIntlClientProvider>
	);

	return { queryClient, user: userEvent.setup(), ...render(ui, { wrapper }) };
};

const selectRole = async ({ role, user }: { role: string; user: ReturnType<typeof userEvent.setup> }) => {
	screen.getByRole("combobox").focus();
	await user.keyboard("{ArrowDown}");
	await user.click(await screen.findByRole("option", { name: `roles.${role}` }));
};

const openRowMenu = async ({ name, user }: { name: string; user: ReturnType<typeof userEvent.setup> }) => {
	const row = (await screen.findByText(name)).closest("li")!;
	await user.click(within(row).getByRole("button", { name: "actions.menu" }));
	await screen.findByRole("menu");
};

describe("organization member management", () => {
	beforeEach(() => {
		team.organizationId = "organization";
		auth.listMembers.mockResolvedValue({
			members: [
				{
					id: "owner-id",
					role: "owner",
					user: { email: "owner@example.com", name: "Owner user" },
					userId: "owner-user",
				},
				{
					id: "member-id",
					role: "member",
					user: { email: "member@example.com", name: "Member user" },
					userId: "member-user",
				},
			],
			total: 2,
		});
		auth.listInvitations.mockResolvedValue([invitation]);

		for (const action of [auth.inviteMember, auth.updateMemberRole, auth.removeMember, auth.cancelInvitation]) {
			action.mockResolvedValue(undefined);
		}
	});

	it("lets members read team rows, roles and expired invitations without mutation controls", async () => {
		organizationPermissionState.role = "member";
		auth.listInvitations.mockResolvedValue([{ ...invitation, expiresAt: "2020-01-01T00:00:00Z" }]);
		renderMembers(<OrganizationMembers />);
		expect(await screen.findByText("Owner user")).toBeInTheDocument();
		expect(await screen.findByText("status.expired")).toBeInTheDocument();
		expect(screen.getByText("roles.owner")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "actions.menu" })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "invite.cta" })).not.toBeInTheDocument();
	});

	it("lets admins invite through a dialog with only Admin and Member choices", async () => {
		organizationPermissionState.role = "admin";
		const { user } = renderMembers();
		await user.click(screen.getByRole("button", { name: "invite.cta" }));
		expect(await screen.findByRole("dialog", { name: "invite.title" })).toBeInTheDocument();
		screen.getByRole("combobox").focus();
		await user.keyboard("{ArrowDown}");
		expect(await screen.findAllByRole("option")).toHaveLength(2);
		expect(screen.queryByRole("option", { name: "roles.owner" })).not.toBeInTheDocument();
		await user.click(screen.getByRole("option", { name: "roles.admin" }));
		await user.type(screen.getByRole("textbox", { name: "invite.fields.email.label" }), "New@Example.com");
		await user.click(screen.getByRole("button", { name: "invite.submit" }));
		await waitFor(() =>
			expect(auth.inviteMember).toHaveBeenCalledWith({
				email: "new@example.com",
				fetchOptions: { throw: true },
				organizationId: "organization",
				resend: false,
				role: "admin",
			})
		);
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
	});

	it("lets admins manage non-owner access and saves only on submission", async () => {
		organizationPermissionState.role = "admin";
		const { user } = renderMembers();
		const owner = (await screen.findByText("Owner user")).closest("li")!;
		expect(within(owner).queryByRole("button", { name: "actions.menu" })).not.toBeInTheDocument();
		await openRowMenu({ name: "Member user", user });
		expect(screen.queryByRole("menuitem", { name: "removeMember" })).not.toBeInTheDocument();
		await user.click(screen.getByRole("menuitem", { name: "manageAccess.title" }));
		await selectRole({ role: "admin", user });
		expect(auth.updateMemberRole).not.toHaveBeenCalled();
		await user.click(screen.getByRole("button", { name: "manageAccess.save" }));
		await waitFor(() =>
			expect(auth.updateMemberRole).toHaveBeenCalledWith({
				fetchOptions: { throw: true },
				memberId: "member-id",
				organizationId: "organization",
				role: "admin",
			})
		);
	});

	it("lets owners edit non-owner access while keeping owner rows locked", async () => {
		const { user } = renderMembers();
		await screen.findByText("Member user");
		expect(
			within(screen.getByText("Owner user").closest("li")!).queryByRole("button", { name: "actions.menu" })
		).not.toBeInTheDocument();
		await openRowMenu({ name: "Member user", user });
		await user.click(screen.getByRole("menuitem", { name: "manageAccess.title" }));
		await selectRole({ role: "admin", user });
		await user.click(screen.getByRole("button", { name: "manageAccess.save" }));
		await waitFor(() =>
			expect(auth.updateMemberRole).toHaveBeenCalledWith({
				fetchOptions: { throw: true },
				memberId: "member-id",
				organizationId: "organization",
				role: "admin",
			})
		);
	});

	it("locks all owner rows even when another owner exists", async () => {
		auth.listMembers.mockResolvedValue({
			members: [
				{
					id: "owner-id",
					role: "owner",
					user: { email: "owner@example.com", name: "Owner user" },
					userId: "owner-user",
				},
				{
					id: "other-owner-id",
					role: "owner",
					user: { email: "other@example.com", name: "Other owner" },
					userId: "other-owner-user",
				},
			],
			total: 2,
		});
		renderMembers();
		const self = (await screen.findByText("Owner user")).closest("li")!;
		expect(within(self).queryByRole("button", { name: "actions.menu" })).not.toBeInTheDocument();
		expect(
			within(screen.getByText("Other owner").closest("li")!).queryByRole("button", { name: "actions.menu" })
		).not.toBeInTheDocument();
	});

	it("requires owner confirmation before removing a teammate", async () => {
		const { user } = renderMembers();
		await screen.findByText("Member user");
		await openRowMenu({ name: "Member user", user });
		await user.click(screen.getByRole("menuitem", { name: "removeMember" }));
		expect(auth.removeMember).not.toHaveBeenCalled();
		await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "back" }));
		expect(auth.removeMember).not.toHaveBeenCalled();
		await openRowMenu({ name: "Member user", user });
		await user.click(screen.getByRole("menuitem", { name: "removeMember" }));
		await user.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", { name: "confirm.submit" })
		);
		await waitFor(() =>
			expect(auth.removeMember).toHaveBeenCalledWith({
				fetchOptions: { throw: true },
				memberIdOrEmail: "member-id",
				organizationId: "organization",
			})
		);
	});

	it("requires owner confirmation before canceling an invitation", async () => {
		const { user } = renderMembers();
		await openRowMenu({ name: invitation.email, user });
		await user.click(screen.getByRole("menuitem", { name: "cancelInvitation" }));
		expect(auth.cancelInvitation).not.toHaveBeenCalled();
		await user.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", { name: "confirm.submit" })
		);
		await waitFor(() =>
			expect(auth.cancelInvitation).toHaveBeenCalledWith({
				fetchOptions: { throw: true },
				invitationId: "invitation-id",
			})
		);
	});

	it("blocks admin resends of owner or unsupported invitations", async () => {
		organizationPermissionState.role = "admin";
		auth.listInvitations.mockResolvedValue([
			{ ...invitation, role: "owner" },
			{ ...invitation, email: "combined@example.com", id: "combined", role: "owner,member" },
		]);
		renderMembers();
		await screen.findByText("invited@example.com");

		for (const email of [invitation.email, "combined@example.com"]) {
			expect(
				within(screen.getByText(email).closest("li")!).queryByRole("button", { name: "actions.menu" })
			).not.toBeInTheDocument();
		}
	});

	it("prevents owners from inviting or resending ownership", async () => {
		auth.listInvitations.mockResolvedValue([{ ...invitation, role: "owner" }]);
		const { user } = renderMembers();
		await openRowMenu({ name: invitation.email, user });
		expect(screen.queryByRole("menuitem", { name: "actions.resend" })).not.toBeInTheDocument();
		expect(screen.getByRole("menuitem", { name: "cancelInvitation" })).toBeInTheDocument();
		await user.keyboard("{Escape}");
		await user.click(screen.getByRole("button", { name: "invite.cta" }));
		screen.getByRole("combobox").focus();
		await user.keyboard("{ArrowDown}");
		expect(await screen.findAllByRole("option")).toHaveLength(2);
		expect(screen.queryByRole("option", { name: "roles.owner" })).not.toBeInTheDocument();
	});

	it("replaces the stale expired card when a resend creates a new invitation ID", async () => {
		const expired = { ...invitation, expiresAt: "2020-01-01T00:00:00Z" };

		const renewed = {
			...invitation,
			createdAt: "2026-09-08T12:00:00Z",
			email: "Invited@example.com",
			id: "renewed-id",
		};

		auth.listInvitations.mockResolvedValueOnce([expired]).mockResolvedValue([expired, renewed]);
		const { user } = renderMembers();
		expect(await screen.findByText("status.expired")).toBeInTheDocument();
		await openRowMenu({ name: expired.email, user });
		await user.click(screen.getByRole("menuitem", { name: "actions.resend" }));
		await waitFor(() =>
			expect(auth.inviteMember).toHaveBeenCalledWith({
				email: invitation.email,
				fetchOptions: { throw: true },
				organizationId: "organization",
				resend: true,
				role: "member",
			})
		);
		await screen.findByText(renewed.email);
		expect(screen.queryByText(expired.email)).not.toBeInTheDocument();
		expect(screen.queryByText("status.expired")).not.toBeInTheDocument();
		await openRowMenu({ name: renewed.email, user });
		await user.click(screen.getByRole("menuitem", { name: "cancelInvitation" }));
		await user.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", { name: "confirm.submit" })
		);
		await waitFor(() =>
			expect(auth.cancelInvitation).toHaveBeenCalledWith({
				fetchOptions: { throw: true },
				invitationId: "renewed-id",
			})
		);
	});

	it("keeps paging scoped and drops old drafts when switching organizations", async () => {
		auth.listMembers.mockResolvedValue({ members: [], total: 51 });
		const { rerender, user } = renderMembers();
		await user.click(await screen.findByRole("button", { name: "next" }));
		await waitFor(() =>
			expect(auth.listMembers).toHaveBeenLastCalledWith({
				fetchOptions: { throw: true },
				query: { limit: 50, offset: 50, organizationId: "organization" },
			})
		);
		await user.click(screen.getByRole("button", { name: "invite.cta" }));
		await user.type(screen.getByRole("textbox"), "unsent@example.com");
		team.organizationId = "other-organization";
		rerender(<OrganizationMembers />);
		await waitFor(() =>
			expect(auth.listMembers).toHaveBeenLastCalledWith({
				fetchOptions: { throw: true },
				query: { limit: 50, offset: 0, organizationId: "other-organization" },
			})
		);
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(auth.inviteMember).not.toHaveBeenCalled();
	});

	it("shows a retry action when native Better Auth fetching throws", async () => {
		auth.listMembers.mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValue({ members: [], total: 0 });
		const { user } = renderMembers();
		expect(await screen.findByRole("alert")).toHaveTextContent("loadFailed");
		await user.click(screen.getByRole("button", { name: "retry" }));
		expect(await screen.findByText("empty.noMembers")).toBeInTheDocument();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("keeps invite input available after a failed request", async () => {
		auth.inviteMember.mockRejectedValue(new Error("blocked"));
		const { user } = renderMembers();
		await user.click(screen.getByRole("button", { name: "invite.cta" }));
		await user.type(screen.getByRole("textbox", { name: "invite.fields.email.label" }), "retry@example.com");
		await user.click(screen.getByRole("button", { name: "invite.submit" }));
		await waitFor(() => expect(auth.inviteMember).toHaveBeenCalledTimes(1));
		expect(screen.getByRole("textbox")).toHaveValue("retry@example.com");
		expect(screen.getByRole("dialog", { name: "invite.title" })).toBeInTheDocument();
	});

	it("fails closed if an open invite dialog loses mutation permission", async () => {
		const { rerender, user } = renderMembers();
		await user.click(screen.getByRole("button", { name: "invite.cta" }));
		await user.type(screen.getByRole("textbox"), "unsent@example.com");
		organizationPermissionState.role = "member";
		rerender(<OrganizationMembers />);
		expect(screen.getByRole("textbox")).toBeDisabled();
		await user.click(screen.getByRole("button", { name: "invite.submit" }));
		expect(auth.inviteMember).not.toHaveBeenCalled();
	});
});
