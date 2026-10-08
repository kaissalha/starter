import type { PropsWithChildren } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	acceptInvitation: vi.fn(),
	createOrganization: vi.fn(),
	listUserInvitations: vi.fn(),
	replace: vi.fn(),
	setActiveOrganization: vi.fn(),
}));

vi.mock("next-intl", () => ({
	useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
	useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		organization: {
			acceptInvitation: mocks.acceptInvitation,
			create: mocks.createOrganization,
			listUserInvitations: mocks.listUserInvitations,
			update: vi.fn(),
		},
	},
	setActiveOrganization: mocks.setActiveOrganization,
}));

vi.mock("@starter/ui/components/toaster", () => ({
	toast: { error: vi.fn() },
}));

import { useOnboardingController } from "@/app/[locale]/onboarding/components/use-onboarding-controller";

const name = "Acme";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
	},
});

const Wrapper = ({ children }: PropsWithChildren) => {
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("useOnboardingController", () => {
	beforeEach(() => {
		queryClient.clear();
		vi.resetAllMocks();
		mocks.acceptInvitation.mockResolvedValue({ data: {}, error: null });
		mocks.listUserInvitations.mockResolvedValue({ data: [], error: null });

		mocks.createOrganization.mockResolvedValue({
			data: { id: "organization-1", name: "Acme" },
			error: null,
		});

		mocks.setActiveOrganization.mockResolvedValue({
			data: { id: "organization-1", name: "Acme" },
			error: null,
		});
	});

	it("creates and activates the workspace, then redirects", async () => {
		const { result } = renderHook(
			() => useOnboardingController({ initialInvitations: null, redirectPath: "/dashboard/chat" }),
			{
				wrapper: Wrapper,
			}
		);

		await act(async () => {
			await expect(result.current.handleCreateOrganization(name)).resolves.toBeNull();
		});

		expect(mocks.createOrganization).toHaveBeenCalledWith({
			name: "Acme",
			slug: "acme",
		});

		expect(mocks.setActiveOrganization).toHaveBeenCalledWith({ organizationId: "organization-1" });
		expect(mocks.replace).toHaveBeenCalledWith("/dashboard/chat");
	});

	it("returns a translated error for a failed organization", async () => {
		mocks.createOrganization.mockResolvedValue({ data: null, error: { message: "Workspace unavailable" } });

		const { result } = renderHook(
			() => useOnboardingController({ initialInvitations: null, redirectPath: "/dashboard" }),
			{ wrapper: Wrapper }
		);

		await act(async () => {
			await expect(result.current.handleCreateOrganization(name)).resolves.toBe("messages.createOrganization");
		});
		expect(mocks.setActiveOrganization).not.toHaveBeenCalled();
		expect(mocks.replace).not.toHaveBeenCalled();
		expect(result.current.isCreating).toBe(false);
	});
	it("reuses the workspace after a failed activation", async () => {
		mocks.setActiveOrganization.mockResolvedValueOnce({ error: { message: "Unavailable" } });

		const { result } = renderHook(
			() => useOnboardingController({ initialInvitations: [], redirectPath: "/dashboard" }),
			{ wrapper: Wrapper }
		);

		await act(async () => {
			expect(await result.current.handleCreateOrganization(name)).toBe("messages.setupFailed");
		});
		expect(result.current.isCreating).toBe(false);
		expect(mocks.replace).not.toHaveBeenCalled();
		await act(async () => {
			expect(await result.current.handleCreateOrganization(name)).toBeNull();
		});
		expect(mocks.createOrganization).toHaveBeenCalledTimes(1);
		expect(mocks.replace).toHaveBeenCalledWith("/dashboard");
	});

	it("accepts an invitation without creating a workspace", async () => {
		const { result } = renderHook(
			() => useOnboardingController({ initialInvitations: [], redirectPath: "/dashboard/chat" }),
			{ wrapper: Wrapper }
		);

		await act(async () => {
			await result.current.handleAcceptInvitation({ invitationId: "invitation-1" });
		});
		expect(mocks.replace).toHaveBeenCalledWith("/dashboard/chat");
		expect(mocks.createOrganization).not.toHaveBeenCalled();
	});
});
