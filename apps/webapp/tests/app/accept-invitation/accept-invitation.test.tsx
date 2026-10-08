import { BetterFetchError } from "@better-fetch/fetch";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { APIError } from "better-auth/api";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AcceptInvitationClient } from "@/app/[locale]/accept-invitation/[id]/accept-invitation-client";
import AcceptInvitationPage from "@/app/[locale]/accept-invitation/[id]/page";
import ar from "@/i18n/messages/ar.json";
import en from "@/i18n/messages/en.json";

import { mockRedirect, mockUseRouter } from "../../mocks/routing";

const mocks = vi.hoisted(() => ({
	accept: vi.fn(),
	activate: vi.fn(),
	getInvitation: vi.fn(),
	getSession: vi.fn(),
	reject: vi.fn(),
	signOut: vi.fn(),
	success: vi.fn(),
}));

vi.mock("next-intl", async (importOriginal) => importOriginal());

vi.mock("@/lib/server/auth", () => ({ getServerSession: mocks.getSession }));

vi.mock("@starter/server/auth", () => ({ auth: { api: { getInvitation: mocks.getInvitation } } }));

vi.mock("@/lib/auth-client", () => ({
	authClient: { organization: { acceptInvitation: mocks.accept, rejectInvitation: mocks.reject } },
	setActiveOrganization: mocks.activate,
	signOut: mocks.signOut,
}));

vi.mock("@starter/ui/components/toaster", () => ({ toast: { success: mocks.success } }));

const invitation = { email: "invited@example.com", organizationName: "Workspace", role: "admin" };

const navigation = { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() };

const renderInvitation = (
	props: Partial<React.ComponentProps<typeof AcceptInvitationClient>> = {},
	locale: "en" | "ar" = "en"
) =>
	render(
		<NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en}>
			<AcceptInvitationClient
				invitation={invitation}
				invitationId='invite-1'
				status='pending'
				userEmail={invitation.email}
				{...props}
			/>
		</NextIntlClientProvider>
	);

const renderPage = async () => {
	const page = AcceptInvitationPage({ params: Promise.resolve({ id: "invite-1" }) });
	const content = page.props.children;

	return render(
		<NextIntlClientProvider locale='en' messages={en}>
			{await content.type(content.props)}
		</NextIntlClientProvider>
	);
};

beforeEach(() => {
	vi.resetAllMocks();
	mockUseRouter.mockReturnValue(navigation);
	mocks.getSession.mockResolvedValue({ user: { email: invitation.email } });
	mocks.getInvitation.mockResolvedValue(invitation);
	mocks.accept.mockResolvedValue({ invitation: { organizationId: "org-1" } });
	mocks.activate.mockResolvedValue({ data: { id: "org-1" }, error: null });
	mocks.reject.mockResolvedValue({ id: "invite-1" });
	mocks.signOut.mockResolvedValue({ data: { success: true }, error: null });
});

describe("invitation recipient page", () => {
	it("sends signed-out recipients to login with their invitation return path", async () => {
		mocks.getSession.mockResolvedValue(null);
		await renderPage();
		expect(mockRedirect).toHaveBeenCalledWith({
			href: "/login?redirect_url=%2Fen%2Faccept-invitation%2Finvite-1",
			locale: "en",
		});
		expect(mocks.getInvitation).not.toHaveBeenCalled();
	});

	it("renders a pending invitation only after its protected lookup succeeds", async () => {
		await renderPage();
		expect(screen.getByRole("button", { name: "Accept invitation" })).toBeEnabled();
		expect(screen.getByText(/with Admin access/)).toBeVisible();
	});

	it("does not offer actions for expired, invalid, or used invitations rejected by Better Auth", async () => {
		mocks.getInvitation.mockRejectedValue(new APIError("BAD_REQUEST", { message: "Invitation not found!" }));
		await renderPage();
		expect(screen.getByText(en.acceptInvitation.unavailable.title)).toBeVisible();
		expect(screen.queryByRole("button", { name: "Accept invitation" })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Decline" })).not.toBeInTheDocument();
	});

	it("handles Better Auth's protected wrong-email response without revealing recipient details", async () => {
		mocks.getInvitation.mockRejectedValue(
			new APIError("FORBIDDEN", {
				code: "YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION",
				message: "Private failure",
			})
		);
		await renderPage();
		expect(screen.getByRole("button", { name: en.acceptInvitation.signInAsOther })).toBeEnabled();
		expect(screen.queryByRole("button", { name: "Accept invitation" })).not.toBeInTheDocument();
		expect(screen.queryByText(/Private failure|Workspace/)).not.toBeInTheDocument();
	});

	it("shows a retry for failed invitation lookups", async () => {
		mocks.getInvitation.mockRejectedValue(new Error("Network unavailable"));
		await renderPage();
		await userEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(navigation.refresh).toHaveBeenCalledOnce();
		expect(screen.queryByRole("button", { name: "Accept invitation" })).not.toBeInTheDocument();
	});
});

describe("invitation responses", () => {
	it("withholds both responses when the signed-in email differs", () => {
		renderInvitation({ userEmail: "other@example.com" });
		expect(screen.getByRole("button", { name: en.acceptInvitation.signInAsOther })).toBeEnabled();
		expect(screen.queryByRole("button", { name: "Accept invitation" })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Decline" })).not.toBeInTheDocument();
	});

	it("matches email addresses without case or surrounding whitespace", () => {
		renderInvitation({ userEmail: " INVITED@example.com " });
		expect(screen.getByRole("button", { name: "Accept invitation" })).toBeEnabled();
	});

	it("withholds acceptance of legacy Owner invitations", () => {
		renderInvitation({ invitation: { ...invitation, role: "owner" } });
		expect(screen.getByText(en.acceptInvitation.unavailable.title)).toBeVisible();
		expect(screen.queryByRole("button", { name: "Accept invitation" })).not.toBeInTheDocument();
	});

	it.each(["owner", "admin", "member"] as const)("localizes the %s role in Arabic", (role) => {
		renderInvitation({ invitation: { ...invitation, role } }, "ar");
		expect(screen.getByText(new RegExp(`بصفة ${ar.acceptInvitation.roles[role]}`))).toBeVisible();
	});

	it("keeps actions pending until the accepted organization is active", async () => {
		const activation = Promise.withResolvers<{ error: null }>();
		mocks.activate.mockReturnValue(activation.promise);
		renderInvitation();
		await userEvent.click(screen.getByRole("button", { name: "Accept invitation" }));
		expect(mocks.accept).toHaveBeenCalledWith({ fetchOptions: { throw: true }, invitationId: "invite-1" });
		expect(mocks.activate).toHaveBeenCalledWith({ organizationId: "org-1" });
		expect(screen.getByRole("button", { name: "Open workspace" })).toBeDisabled();
		expect(navigation.replace).not.toHaveBeenCalled();
		await act(async () => activation.resolve({ error: null }));
		expect(navigation.replace).toHaveBeenCalledWith("/dashboard");
	});

	it.each(["response", "network"])(
		"retries activation after an %s failure without accepting twice",
		async (failure) => {
			if (failure === "response") {
				mocks.activate.mockResolvedValueOnce({ error: { message: "Denied" } });
			} else {
				mocks.activate.mockRejectedValueOnce(new Error("Offline"));
			}

			renderInvitation();
			await userEvent.click(screen.getByRole("button", { name: "Accept invitation" }));
			expect(screen.getByRole("alert")).toHaveTextContent(en.acceptInvitation.messages.activateError);
			expect(navigation.replace).not.toHaveBeenCalled();
			expect(screen.queryByRole("button", { name: "Decline" })).not.toBeInTheDocument();
			await userEvent.click(screen.getByRole("button", { name: "Open workspace" }));
			expect(mocks.accept).toHaveBeenCalledOnce();
			expect(mocks.activate).toHaveBeenCalledTimes(2);
			expect(navigation.replace).toHaveBeenCalledWith("/dashboard");
		}
	);

	it.each(
		[
			{ action: "accept" as const, label: "Accept invitation", message: "acceptError" as const },
			{ action: "reject" as const, label: "Decline", message: "rejectError" as const },
		].flatMap((scenario) => [
			{ ...scenario, failure: new Error("Offline") },
			{ ...scenario, failure: new BetterFetchError(403, "Forbidden", { message: "Denied" }) },
		])
	)("recovers $action after $failure and permits retry", async ({ action, failure, label, message }) => {
		mocks[action].mockRejectedValueOnce(failure);
		renderInvitation();
		await userEvent.click(screen.getByRole("button", { name: label }));
		expect(mocks[action]).toHaveBeenCalledWith({ fetchOptions: { throw: true }, invitationId: "invite-1" });
		expect(screen.getByRole("alert")).toHaveTextContent(en.acceptInvitation.messages[message]);
		expect(screen.getByRole("button", { name: label })).toBeEnabled();
		expect(navigation.replace).not.toHaveBeenCalled();
		await userEvent.click(screen.getByRole("button", { name: label }));
		expect(navigation.replace).toHaveBeenCalledWith("/dashboard");
	});

	it("disables both responses while declining", async () => {
		const rejection = Promise.withResolvers<{ id: string }>();
		mocks.reject.mockReturnValue(rejection.promise);
		renderInvitation();
		await userEvent.click(screen.getByRole("button", { name: "Decline" }));
		expect(screen.getByRole("button", { name: "Decline" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Accept invitation" })).toBeDisabled();
		await act(async () => rejection.resolve({ id: "invite-1" }));
		expect(navigation.replace).toHaveBeenCalledWith("/dashboard");
		expect(mocks.activate).not.toHaveBeenCalled();
	});

	it("preserves the invitation when changing accounts and handles sign-out failures", async () => {
		window.history.replaceState(null, "", "/ar/accept-invitation/invite-1");
		mocks.signOut.mockRejectedValueOnce(new Error("Offline"));
		renderInvitation({ invitation: undefined, status: "mismatch" });
		await userEvent.click(screen.getByRole("button", { name: en.acceptInvitation.signInAsOther }));
		expect(screen.getByText(en.acceptInvitation.messages.signOutError)).toBeVisible();
		expect(navigation.replace).not.toHaveBeenCalled();
		await userEvent.click(screen.getByRole("button", { name: en.acceptInvitation.signInAsOther }));
		expect(navigation.replace).toHaveBeenCalledWith("/login?redirect_url=%2Far%2Faccept-invitation%2Finvite-1");
	});
});
