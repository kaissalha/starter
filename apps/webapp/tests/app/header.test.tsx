import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Header } from "@/app/[locale]/dashboard/components/layout/header/header";
import { SidebarProvider } from "@starter/ui/components/sidebar";

vi.mock("@/lib/api-client", () => ({
	apiClient: {
		notifications: {
			counts: {
				queryOptions: () => ({ queryFn: async () => ({ unseen: 0 }), queryKey: ["notifications", "counts"] }),
			},
		},
	},
}));

const wrapper = ({ children }: { children: ReactNode }) => (
	<QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe("dashboard header", () => {
	it("replaces the route title with leading route controls", () => {
		render(
			<SidebarProvider purpose='navigation'>
				<Header item={{ label: "Website" }} leading={<button type='button'>English</button>} />
			</SidebarProvider>,
			{ wrapper }
		);

		expect(screen.queryByText("Website")).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "English" })).toBeInTheDocument();
	});
});
