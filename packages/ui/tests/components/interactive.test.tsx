import * as React from "react";

import { DirectionProvider } from "@base-ui/react/direction-provider";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Dialog, DialogPopup, DialogTitle } from "../../src/components/dialog";
import { Drawer, DrawerDescription, DrawerPopup, DrawerTitle } from "../../src/components/drawer";
import { Sidebar, SidebarProvider } from "../../src/components/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../src/components/tabs";

describe("interactive components", () => {
	it.each([
		{ direction: "ltr", expected: "right", position: "end" },
		{ direction: "rtl", expected: "left", position: "end" },
		{ direction: "rtl", expected: "right", position: "start" },
		{ direction: "ltr", expected: "left", position: "start" },
		{ direction: "rtl", expected: "left", position: "left" },
		{ direction: "rtl", expected: "right", position: "right" },
		{ direction: "rtl", expected: "down", position: "bottom" },
		{ direction: "rtl", expected: "up", position: "top" },
	] satisfies Array<{
		direction: "ltr" | "rtl";
		expected: string;
		position: React.ComponentProps<typeof Drawer>["position"];
	}>)("keeps $direction $position drawer placement and swipe aligned", async ({ direction, expected, position }) => {
		const result = await act(async () =>
			render(
				<DirectionProvider direction={direction}>
					<Drawer defaultOpen position={position}>
						<DrawerPopup>
							<DrawerTitle>Direction test</DrawerTitle>
							<DrawerDescription>Drawer direction</DrawerDescription>
							<Tabs defaultValue='details'>
								<TabsList>
									<TabsTrigger value='details'>Details</TabsTrigger>
								</TabsList>
								<TabsContent value='details'>Contact details</TabsContent>
							</Tabs>
						</DrawerPopup>
					</Drawer>
				</DirectionProvider>
			)
		);

		const popup = result.getByRole("dialog");
		expect(result.getByRole("tablist").parentElement).not.toHaveAttribute("dir");
		expect(popup).toHaveAttribute("data-swipe-direction", expected);
		expect(popup).toHaveAttribute(
			"data-position",
			position === "top" || position === "bottom" ? position : expected
		);
		result.unmount();
	});

	it.each([
		["Cerrar", "Cerrar"],
		[undefined, "Close"],
	])("labels the dialog close button with %s", (closeLabel, name) => {
		render(
			<Dialog defaultOpen>
				<DialogPopup closeLabel={closeLabel}>
					<DialogTitle>Title</DialogTitle>
				</DialogPopup>
			</Dialog>
		);

		expect(screen.getByRole("button", { name })).toBeInTheDocument();
	});

	it("positions an RTL details sidebar from its resolved physical side", () => {
		const { container } = render(
			<SidebarProvider defaultOpen={false} dir='rtl' purpose='details'>
				<Sidebar purpose='details'>Details</Sidebar>
			</SidebarProvider>
		);

		const desktopSidebar = container.querySelector("[data-purpose='details']");
		const panel = desktopSidebar?.children.item(1);

		expect(desktopSidebar).toHaveAttribute("data-side", "left");
		expect(panel).toHaveClass("left-0", "group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]");
		expect(panel).not.toHaveClass("inset-s-0");
	});

	it("puts an RTL navigation sidebar border on its inner edge", () => {
		const { container } = render(
			<SidebarProvider dir='rtl' purpose='navigation'>
				<Sidebar purpose='navigation'>Navigation</Sidebar>
			</SidebarProvider>
		);

		const desktopSidebar = container.querySelector("[data-purpose='navigation']");
		const panel = desktopSidebar?.children.item(1);

		expect(desktopSidebar).toHaveAttribute("data-side", "right");
		expect(panel).toHaveClass("right-0", "border-l", "border-sidebar-border");
		expect(panel).not.toHaveClass("border-r");
	});
});
