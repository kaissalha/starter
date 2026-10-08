import type { ComponentProps, ReactNode } from "react";

import { vi } from "vitest";

type MockLinkProps = ComponentProps<"a"> & {
	children: ReactNode;
	href: string;
};

export const mockLink = ({ children, href, ref, ...props }: MockLinkProps) => (
	<a href={href} ref={ref} {...props}>
		{children}
	</a>
);

export const mockRedirect = vi.fn();

export const mockUsePathname = vi.fn(() => "/");

export const mockUseRouter = vi.fn(() => ({
	push: vi.fn(),
	replace: vi.fn(),
}));

export const mockUseParams = vi.fn();

export const mockUseSearchParams = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", async () => {
	const actual = await import("next/navigation");

	return {
		...actual,
		useParams: mockUseParams,
		useSearchParams: mockUseSearchParams,
	};
});

vi.mock("@/i18n/navigation", async () => {
	const actual = await import("@/i18n/navigation");

	const mock = {
		Link: mockLink,
		redirect: mockRedirect,
		usePathname: mockUsePathname,
		useRouter: mockUseRouter,
	};

	return {
		...actual,
		...mock,
	};
});
