import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { WebsiteDomainsPanel } from "@/app/[locale]/dashboard/website/website-domains-panel";
import ar from "@/i18n/messages/ar.json";
import en from "@/i18n/messages/en.json";

vi.unmock("next-intl");

const mocks = vi.hoisted(() => ({
	availability: vi.fn(),
	connect: vi.fn(),
	list: vi.fn(),
	mutation: vi.fn(),
	prices: vi.fn(),
	purchase: vi.fn(),
	quote: vi.fn(),
	search: vi.fn(),
}));

vi.mock("@/hooks/use-organization-permissions", () => ({
	useOrganizationPermissions: () => ({ can: () => true }),
}));

vi.mock("@/lib/api-client", () => {
	const mutation = (mutationFn: Mock) => ({
		mutationOptions: (options: { onSettled?: () => void; onSuccess?: (data: never) => void } = {}) => ({
			mutationFn,
			...options,
		}),
	});

	return {
		apiClient: {
			domains: {
				autoRenew: mutation(mocks.mutation),
				availability: {
					queryOptions: (options: { enabled: boolean; input: { domains: Array<string> } }) => ({
						enabled: options.enabled,
						queryFn: () => mocks.availability(options.input),
						queryKey: ["availability", ...options.input.domains],
					}),
				},
				changeMethod: mutation(mocks.mutation),
				connect: mutation(mocks.connect),
				disconnect: mutation(mocks.mutation),
				list: { queryOptions: () => ({ queryFn: mocks.list, queryKey: ["domains"] }) },
				prices: {
					queryOptions: (options: { enabled: boolean; input: { domains: Array<string> } }) => ({
						enabled: options.enabled,
						queryFn: () => mocks.prices(options.input),
						queryKey: ["prices", ...options.input.domains],
					}),
				},
				purchase: mutation(mocks.purchase),
				quote: {
					queryOptions: (options: { input: { domain: string } }) => ({
						queryFn: () => mocks.quote(options.input),
						queryKey: ["quote", options.input.domain],
					}),
				},
				setAutoRenew: mutation(mocks.mutation),
				setPrimary: mutation(mocks.mutation),
				suggest: {
					queryOptions: (options: { enabled: boolean; input: { query: string } }) => ({
						enabled: options.enabled,
						queryFn: () => mocks.search(options.input),
						queryKey: ["suggest", options.input.query],
					}),
				},
				transferCode: mutation(mocks.mutation),
				updateSubdomain: mutation(mocks.mutation),
				verify: mutation(mocks.mutation),
			},
		},
	};
});

const emptyList = { address: null, businessName: "Nockta", domains: [], registrations: [], subdomain: null };

const pendingDomain = (hostname: string) => ({
	caaBlocked: false,
	conflicts: [{ name: hostname, ready: false, type: "A", value: "192.0.2.10" }],
	dnsReady: false,
	hostname,
	id: hostname,
	method: "records",
	ownershipRecord: { name: "_starter-verification.example.sa", type: "TXT", value: "proof" },
	ownershipVerified: false,
	primary: false,
	records: [
		{
			name: hostname,
			ready: hostname === "example.sa",
			type: hostname.startsWith("www.") ? "CNAME" : "A",
			value: "vercel",
		},
	],
	registrationId: null,
	status: "pending",
	tlsReady: false,
});

beforeEach(() => {
	vi.clearAllMocks();
	mocks.list.mockResolvedValue(emptyList);
	mocks.connect.mockResolvedValue(emptyList);
});

const mountPanel = (locale: "en" | "ar") => {
	const messages = locale === "ar" ? ar : en;
	const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
	render(
		<QueryClientProvider client={client}>
			<NextIntlClientProvider locale={locale} messages={messages}>
				<WebsiteDomainsPanel />
			</NextIntlClientProvider>
		</QueryClientProvider>
	);

	return messages.website.domains;
};

describe("Domains panel", () => {
	it.each(["en", "ar"] as const)("connects an existing domain by nameservers in %s", async (locale) => {
		const t = mountPanel(locale);
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: t.title }));
		await user.click(screen.getByRole("button", { name: new RegExp(t.connectTitle, "u") }));
		expect(screen.getByRole("button", { name: t.connect })).toBeDisabled();
		const input = screen.getByRole("textbox", { name: t.hostname });
		expect(input).toHaveAttribute("dir", "ltr");
		await user.type(input, "example.sa");
		await user.click(screen.getByRole("button", { name: t.methodNameservers }));
		await user.click(screen.getByRole("button", { name: t.connect }));
		await waitFor(() =>
			expect(mocks.connect).toHaveBeenCalledWith(
				{ hostname: "example.sa", method: "nameservers" },
				expect.anything()
			)
		);
	});
	it("searches the business name, loads prices after availability, and opens checkout", async () => {
		mocks.search.mockResolvedValue({
			domains: ["nockta.com", "nockta.co", "getnockta.com"],
			unsupportedSuffix: null,
		});
		mocks.availability.mockResolvedValue([
			{ available: false, domain: "nockta.com" },
			{ available: true, domain: "nockta.co" },
			{ available: true, domain: "getnockta.com" },
		]);
		mocks.prices.mockResolvedValue([
			{ domain: "nockta.co", purchasePrice: 9.99, renewalPrice: 29.99 },
			{ domain: "getnockta.com", purchasePrice: 11.25, renewalPrice: 11.25 },
		]);
		mocks.quote.mockResolvedValue({
			additional: [],
			available: true,
			base: [],
			domain: "nockta.co",
			purchaseEnabled: false,
			purchasePrice: 9.99,
			renewalPrice: 29.99,
			years: 1,
		});
		const t = mountPanel("en");
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: t.title }));
		await user.click(await screen.findByRole("button", { name: new RegExp(t.findTitle, "u") }));
		expect(screen.getByRole("textbox", { name: t.searchLabel })).toHaveValue("Nockta");
		expect(await screen.findByText("$9.99 per year")).toBeInTheDocument();
		expect(mocks.search).toHaveBeenCalledWith({ query: "Nockta" });
		expect(mocks.prices).toHaveBeenCalledWith({ domains: ["nockta.co", "getnockta.com"] });
		expect(screen.queryByRole("button", { name: /^nockta\.com/u })).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /^nockta\.co\$/u }));
		expect(await screen.findByText(t.registrationDeferred)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: t.getDomain })).toBeDisabled();
		expect(mocks.purchase).not.toHaveBeenCalled();
	});
	it("shows one record set for apex and www with readiness and stale records", async () => {
		mocks.list.mockResolvedValue({
			...emptyList,
			domains: [pendingDomain("example.sa"), pendingDomain("www.example.sa")],
		});
		const t = mountPanel("en");
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: t.title }));
		await screen.findByRole("heading", { name: "example.sa" });
		expect(screen.getByText(t.status.ownership)).toBeInTheDocument();
		expect(screen.getByText("_starter-verification")).toBeInTheDocument();
		expect(screen.getByText("proof")).toBeInTheDocument();
		expect(screen.getAllByText("www")).toHaveLength(2);
		expect(screen.getAllByRole("img", { name: t.recordReady })).toHaveLength(1);
		expect(screen.getByText(t.removeRecords)).toBeInTheDocument();
		expect(screen.getAllByText("192.0.2.10")).toHaveLength(2);
		expect(
			screen.getAllByRole("heading", { level: 3 }).filter((node) => node.textContent === "example.sa")
		).toHaveLength(1);
	});
	it.each([
		["asks for the ownership record before showing nameservers", false],
		["shows nameservers once ownership is verified", true],
	])("%s", async (_name, ownershipVerified) => {
		mocks.list.mockResolvedValue({
			...emptyList,
			domains: [
				{
					...pendingDomain("example.sa"),
					conflicts: [],
					method: "nameservers",
					ownershipRecord: ownershipVerified ? null : pendingDomain("example.sa").ownershipRecord,
					ownershipVerified,
					records: [],
				},
			],
		});
		const { title } = mountPanel("en");
		await userEvent.setup().click(screen.getByRole("button", { name: title }));
		expect(await screen.findByRole("heading", { name: "example.sa" })).toBeInTheDocument();
		expect(Boolean(screen.queryByText("_starter-verification"))).toBe(!ownershipVerified);
		expect(Boolean(screen.queryByText("ns1.vercel-dns.com"))).toBe(ownershipVerified);
	});
});
