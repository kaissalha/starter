import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useEditorSidebar } from "@/app/[locale]/dashboard/components/editor/use-editor-sidebar";

const { mockUsePathname } = vi.hoisted(() => ({ mockUsePathname: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({ usePathname: mockUsePathname }));

const Editor = ({ path }: { path: string }) => <div {...useEditorSidebar(path)} />;

const CachedEditors = () => (
	<>
		<Editor path='/dashboard/website' />
		<Editor path='/dashboard/links' />
		<Editor path='/dashboard/blog/post-one' />
		<Editor path='/dashboard/blog/post-two' />
	</>
);

describe("editor sidebar", () => {
	it("restores the border outside editors and activates only the current cached editor", () => {
		mockUsePathname.mockReturnValue("/dashboard/blog/post-one");
		const view = render(<CachedEditors />);
		expect(view.container.querySelectorAll("[data-dashboard-editor]")).toHaveLength(1);
		expect(view.container.children[2]).toHaveAttribute("data-dashboard-editor");

		for (const pathname of ["/dashboard/blog", "/dashboard", "/dashboard/contacts"]) {
			mockUsePathname.mockReturnValue(pathname);
			view.rerender(<CachedEditors />);
			expect(view.container.querySelector("[data-dashboard-editor]")).toBeNull();
		}

		for (const [index, pathname] of [
			"/dashboard/website",
			"/dashboard/links",
			"/dashboard/blog/post-one",
			"/dashboard/blog/post-two",
		].entries()) {
			mockUsePathname.mockReturnValue(pathname);
			view.rerender(<CachedEditors />);
			expect(view.container.querySelectorAll("[data-dashboard-editor]")).toHaveLength(1);
			expect(view.container.children[index]).toHaveAttribute("data-dashboard-editor");
		}
	});
});
