import type { PropsWithChildren } from "react";

import { ORPCError } from "@orpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	acceptInvitation: vi.fn(),
	createOrganization: vi.fn(),
	generateWebsite: vi.fn(),
	getWebsite: vi.fn(),
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

vi.mock("@/lib/api-client", () => ({
	apiClient: {
		websites: {
			generate: { mutationOptions: () => ({ mutationFn: mocks.generateWebsite }) },
			get: {
				key: () => ["website"],
				queryOptions: () => ({ queryFn: mocks.getWebsite, queryKey: ["website"], staleTime: 0 }),
			},
		},
	},
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

const business = { location: "Toronto", name: "Acme", type: "Design studio" };

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
		mocks.getWebsite.mockResolvedValue(null);
		mocks.generateWebsite.mockResolvedValue({ websiteId: "website-1", workflowRunId: "run-1" });
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
			await expect(result.current.handleCreateOrganization(business)).resolves.toBeNull();
		});

		expect(mocks.createOrganization).toHaveBeenCalledWith({
			name: "Acme",
			slug: "acme",
		});

		expect(mocks.setActiveOrganization).toHaveBeenCalledWith({ organizationId: "organization-1" });
		expect(mocks.generateWebsite).toHaveBeenCalledWith(
			{ brief: { ...business, schemaVersion: 1 } },
			expect.anything()
		);
		expect(mocks.replace).toHaveBeenCalledWith("/dashboard/website");
	});

	it.each([
		{ activationCalls: 1, failure: "brief", message: "messages.implausibleBrief" },
		{ activationCalls: 0, failure: "organization", message: "messages.createOrganization" },
	])("returns a translated error for a failed $failure", async ({ activationCalls, failure, message }) => {
		if (failure === "brief") {
			mocks.generateWebsite.mockRejectedValueOnce(new ORPCError("IMPLAUSIBLE_BRIEF"));
		} else {
			mocks.createOrganization.mockResolvedValue({ data: null, error: { message: "Workspace unavailable" } });
		}

		const { result } = renderHook(
			() => useOnboardingController({ initialInvitations: null, redirectPath: "/dashboard" }),
			{ wrapper: Wrapper }
		);

		await act(async () => {
			await expect(result.current.handleCreateOrganization(business)).resolves.toBe(message);
		});
		expect(mocks.setActiveOrganization).toHaveBeenCalledTimes(activationCalls);
		expect(mocks.replace).not.toHaveBeenCalled();
		expect(result.current.isCreating).toBe(false);
	});
	it.each(["activation", "generation"])("reuses the workspace after a failed %s", async (failure) => {
		if (failure === "activation") {
			mocks.setActiveOrganization.mockResolvedValueOnce({ error: { message: "Unavailable" } });
		} else {
			mocks.generateWebsite.mockRejectedValueOnce(new Error("Unavailable"));
		}

		const { result } = renderHook(
			() => useOnboardingController({ initialInvitations: [], redirectPath: "/dashboard" }),
			{ wrapper: Wrapper }
		);

		await act(async () => {
			expect(await result.current.handleCreateOrganization(business)).toBe("messages.setupFailed");
		});
		expect(result.current.isCreating).toBe(false);
		expect(mocks.replace).not.toHaveBeenCalled();
		await act(async () => {
			expect(await result.current.handleCreateOrganization(business)).toBeNull();
		});
		expect(mocks.createOrganization).toHaveBeenCalledTimes(1);
		expect(mocks.replace).toHaveBeenCalledWith("/dashboard/website");
	});

	it("resumes an already started generation after a lost response", async () => {
		mocks.generateWebsite.mockRejectedValueOnce(new Error("Disconnected"));

		const { result } = renderHook(
			() => useOnboardingController({ initialInvitations: [], redirectPath: "/dashboard" }),
			{ wrapper: Wrapper }
		);

		await act(async () => {
			await result.current.handleCreateOrganization(business);
		});
		mocks.getWebsite.mockResolvedValue({ snapshot: null, workflow: { state: "active" } });
		await act(async () => {
			expect(await result.current.handleCreateOrganization(business)).toBeNull();
		});
		expect(mocks.createOrganization).toHaveBeenCalledTimes(1);
		expect(mocks.generateWebsite).toHaveBeenCalledTimes(1);
	});

	it("accepts an invitation without creating or generating a business", async () => {
		const { result } = renderHook(
			() => useOnboardingController({ initialInvitations: [], redirectPath: "/dashboard/chat" }),
			{ wrapper: Wrapper }
		);

		await act(async () => {
			await result.current.handleAcceptInvitation({ invitationId: "invitation-1" });
		});
		expect(mocks.replace).toHaveBeenCalledWith("/dashboard/chat");
		expect(mocks.createOrganization).not.toHaveBeenCalled();
		expect(mocks.generateWebsite).not.toHaveBeenCalled();
	});
});
