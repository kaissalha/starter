import { act, useState } from "react";

import { DirectionProvider } from "@base-ui/react/direction-provider";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

// @ts-expect-error The Vitest browser pipeline loads CSS side-effect imports.
import "../../src/globals.css";

import { Accordion, AccordionItem, AccordionPanel, AccordionTrigger } from "../../src/components/accordion";
import { Button } from "../../src/components/button";
import { SpectrumChart } from "../../src/components/charts/genui-charts";
import { Dialog, DialogDescription, DialogPopup, DialogTitle, DialogTrigger } from "../../src/components/dialog";
import { Drawer, DrawerPopup, DrawerTitle, DrawerDescription, DrawerTrigger } from "../../src/components/drawer";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuSub,
	DropdownMenuSubTrigger,
	DropdownMenuSubContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
} from "../../src/components/dropdown-menu";
import { Field, FieldControl, FieldDescription, FieldLabel } from "../../src/components/field";
import { Input } from "../../src/components/input";
import { Masonry } from "../../src/components/masonry";
import {
	NavigationMenu,
	NavigationMenuList,
	NavigationMenuItem,
	NavigationMenuTrigger,
	NavigationMenuContent,
	NavigationMenuLink,
} from "../../src/components/navigation-menu";
import {
	NumberField,
	NumberFieldGroup,
	NumberFieldInput,
	NumberFieldIncrement,
} from "../../src/components/number-field";
import { Radio, RadioGroup } from "../../src/components/radio-group";
import { Select, SelectTrigger, SelectPopup, SelectItem } from "../../src/components/select";
import { Slider } from "../../src/components/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../src/components/tabs";
import { cleanup, render, rerender } from "../browser-render";

const reactGlobal: typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean } = globalThis;

reactGlobal.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(async () => {
	await cleanup();
	document.documentElement.removeAttribute("dir");
});

describe("interactive components in Chromium", () => {
	it.each([
		{ padding: "3px", size: "sm" },
		{ padding: "5px", size: "default" },
		{ padding: "7px", size: "lg" },
	] as const)("inherits number-field $size sizing through compound components", async ({ padding, size }) => {
		const container = await render(
			<NumberField defaultValue={2} size={size}>
				<NumberFieldGroup>
					<NumberFieldInput aria-label='Quantity' />
					<NumberFieldIncrement aria-label='Increase quantity' />
				</NumberFieldGroup>
			</NumberField>
		);

		const input = container.querySelector("input");

		if (!input) {
			throw new Error("Missing number field");
		}

		expect(getComputedStyle(input).paddingTop).toBe(padding);
		await userEvent.click(page.getByRole("button", { name: "Increase quantity" }));
		await expect.poll(() => input.value).toBe("3");
	});

	it("preserves pill corners and overlay input padding across size variants", async () => {
		const container = await render(
			<div>
				<Input aria-label='Large pill' corners='pill' size='xl' />
				<Input aria-label='Overlay' size='xl' variant='overlay' />
			</div>
		);

		const pill = container.querySelector('[data-slot="input-control"]');
		const overlay = container.querySelector('input[aria-label="Overlay"]');

		if (!(pill && overlay)) {
			throw new Error("Missing input variants");
		}

		expect(Number.parseFloat(getComputedStyle(pill).borderRadius)).toBeGreaterThanOrEqual(
			pill.getBoundingClientRect().height / 2
		);
		expect(getComputedStyle(overlay).padding).toBe("0px");
	});

	it("keeps fullscreen dialogs full width when combined with a size variant", async () => {
		const viewport = { height: window.innerHeight, width: window.innerWidth };
		await page.viewport(1024, 768);
		await render(
			<Dialog defaultOpen>
				<DialogPopup fullScreen size='xl' variant='default'>
					<DialogTitle>Full screen</DialogTitle>
					<DialogDescription>Variant precedence</DialogDescription>
				</DialogPopup>
			</Dialog>
		);
		const popup = document.querySelector('[data-slot="dialog-popup"]');

		if (!popup) {
			throw new Error("Missing fullscreen dialog");
		}

		expect(getComputedStyle(popup).maxWidth).toBe("none");
		expect(getComputedStyle(popup).padding).toBe("0px");
		expect(getComputedStyle(popup).borderRadius).toBe("0px");
		await page.viewport(viewport.width, viewport.height);
	});

	it("reveals insertion buttons on keyboard focus without losing their pill styling", async () => {
		const activated = vi.fn();

		const container = await render(
			<div className='group/button-reveal'>
				<Button onClick={activated} revealOnHover size='xs' variant='insertion'>
					Add section
				</Button>
			</div>
		);

		const element = container.querySelector("button");

		if (!element) {
			throw new Error("Missing insertion button");
		}

		await expect.poll(() => getComputedStyle(element).opacity).toBe("0");
		await act(async () => userEvent.tab());
		await expect.poll(() => getComputedStyle(element).opacity).toBe("1");
		expect(getComputedStyle(element).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
		expect(getComputedStyle(element).color).toBe("rgb(255, 255, 255)");
		expect(Number.parseFloat(getComputedStyle(element).borderRadius)).toBeGreaterThanOrEqual(
			element.getBoundingClientRect().height / 2
		);
		await act(async () => userEvent.keyboard("{Enter}"));
		expect(activated).toHaveBeenCalledOnce();
	});

	it.each(["ltr", "rtl"] as const)("labels the %s slider and supports keyboard changes", async (direction) => {
		const onValueChange = vi.fn();

		const container = await render(
			<DirectionProvider direction={direction}>
				<Slider aria-label='Button opacity' defaultValue={50} onValueChange={onValueChange} />
			</DirectionProvider>
		);

		const slider = page.getByRole("slider", { name: "Button opacity" });
		await expect.element(slider).toHaveAttribute("aria-valuenow", "50");
		const input = container.querySelector("input");
		await act(async () => input?.focus());
		await act(async () => userEvent.keyboard(direction === "rtl" ? "{ArrowLeft}" : "{ArrowRight}"));
		await expect.element(slider).toHaveAttribute("aria-valuenow", "51");
		expect(onValueChange).toHaveBeenCalledWith(51, expect.anything());
	});

	it("preserves field labels, descriptions and input events through shared variants", async () => {
		const onValueChange = vi.fn();
		await render(
			<Field name='name'>
				<FieldLabel>Name</FieldLabel>
				<FieldControl onValueChange={onValueChange} size='xl' variant='subtle' />
				<FieldDescription>Display name</FieldDescription>
			</Field>
		);
		const input = page.getByRole("textbox", { name: "Name" });
		await act(async () => input.fill("Example"));
		await expect.element(input).toHaveValue("Example");
		await expect.element(input).toHaveAccessibleDescription("Display name");
		expect(onValueChange).toHaveBeenCalled();
	});

	it("keeps card radio controls keyboard selectable", async () => {
		const container = await render(
			<RadioGroup aria-label='Layout' defaultValue='one'>
				<label>
					<Radio value='one' variant='card' />
					One
				</label>
				<label>
					<Radio value='two' variant='card' />
					Two
				</label>
			</RadioGroup>
		);

		const radio = container.querySelector<HTMLElement>('[role="radio"]');

		if (!radio) {
			throw new Error("Radio missing");
		}

		await act(async () => radio.focus());
		await act(async () => userEvent.keyboard("{ArrowDown}"));
		await expect.element(page.getByRole("radio", { name: "Two" })).toHaveAttribute("aria-checked", "true");
	});

	it("matches subtle select sizing to buttons and supports keyboard selection", async () => {
		const changed = vi.fn();

		const container = await render(
			<div className='flex items-center gap-2'>
				<Select defaultValue='home' onValueChange={changed}>
					<SelectTrigger aria-label='Page' size='sm' variant='subtle'>
						Home
					</SelectTrigger>
					<SelectPopup>
						<SelectItem value='home'>Home</SelectItem>
						<SelectItem value='about'>About</SelectItem>
					</SelectPopup>
				</Select>
				<Button size='sm'>Customize</Button>
			</div>
		);

		const trigger = container.querySelector("[data-slot='select-trigger']");
		const button = container.querySelector("[data-slot='button']");

		if (!trigger || !button) {
			throw new Error("Header controls missing");
		}

		expect(trigger.getBoundingClientRect().height).toBe(button.getBoundingClientRect().height);
		expect(getComputedStyle(trigger).fontSize).toBe(getComputedStyle(button).fontSize);
		await act(async () => page.getByRole("combobox", { name: "Page" }).click());
		await act(async () => userEvent.keyboard("{ArrowDown}{Enter}"));
		expect(changed).toHaveBeenCalledWith("about", expect.anything());
	});

	it("keeps image click targets transparent and keyboard accessible", async () => {
		const clicked = vi.fn();

		const container = await render(
			<div className='relative h-40 w-60 rounded-xl'>
				<Button
					aria-label='Edit image'
					className='absolute inset-0 size-full'
					corners='inherit'
					onClick={clicked}
					unstyled
				/>
			</div>
		);

		const button = page.getByRole("button", { name: "Edit image" });
		const element = container.querySelector("button");

		if (!element) {
			throw new Error("Image control missing");
		}

		await act(async () => userEvent.tab());
		await expect.element(button).toHaveFocus();
		expect(getComputedStyle(element).backgroundColor).toBe("rgba(0, 0, 0, 0)");
		expect(getComputedStyle(element).borderWidth).toBe("0px");
		expect(getComputedStyle(element).borderRadius).toBe(
			getComputedStyle(container.firstElementChild ?? container).borderRadius
		);
		expect(getComputedStyle(element).boxShadow).not.toBe("none");
		await act(async () => userEvent.keyboard("{Enter}"));
		expect(clicked).toHaveBeenCalledOnce();
	});

	it("keeps destructive outline labels readable and preserves their loading color", async () => {
		const container = await render(<Button variant='destructive-outline'>Delete menu item</Button>);
		const button = container.querySelector("button");

		if (!button) {
			throw new Error("Button missing");
		}

		const color = getComputedStyle(button).color;

		const channels =
			color
				.match(/[\d.]+/g)
				?.slice(0, 3)
				.map(Number) ?? [];

		expect(channels).toHaveLength(3);

		const luminance = channels.reduce((sum, channel, index) => {
			const value = channel / 255;
			const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

			return sum + linear * ([0.2126, 0.7152, 0.0722][index] ?? 0);
		}, 0);

		expect(1.05 / (luminance + 0.05)).toBeGreaterThanOrEqual(4.5);
		await act(async () =>
			rerender(
				<Button loading variant='destructive-outline'>
					Delete menu item
				</Button>
			)
		);
		const spinner = button.querySelector("[data-slot='button-loading-indicator'] svg");

		if (!spinner) {
			throw new Error("Spinner missing");
		}

		expect(getComputedStyle(spinner).color).toBe(color);
	});

	it("preserves loading button dimensions and renders a Hugeicons spinner", async () => {
		const container = await render(<Button>Publish</Button>);
		const button = page.getByRole("button", { name: "Publish" });
		const element = container.querySelector("button");

		if (!element) {
			throw new Error("Button missing");
		}

		const width = element.getBoundingClientRect().width;
		expect(Number.parseFloat(getComputedStyle(element).borderRadius)).toBeGreaterThanOrEqual(
			element.getBoundingClientRect().height / 2
		);
		await act(async () => rerender(<Button loading>Publish</Button>));
		await expect.element(button).toBeDisabled();
		await expect.element(button).toHaveAttribute("aria-busy", "true");
		expect(element.getBoundingClientRect().width).toBe(width);
		expect(element.querySelector("[data-slot='button-loading-indicator'] svg")).not.toBeNull();
	});

	it.each(["ltr", "rtl"] as const)("centers loading indicators in full-width grid buttons in $0", async (dir) => {
		const content = (
			<>
				<svg aria-hidden='true' className='justify-self-start' fill='#4285F4' viewBox='0 0 24 24'>
					<circle cx='12' cy='12' r='10' />
				</svg>
				<span>Continue with Google</span>
				<span>Last used</span>
			</>
		);

		const container = await render(
			<Button className='grid w-full grid-cols-[1fr_auto_1fr]' dir={dir} size='xl'>
				{content}
			</Button>
		);

		const element = container.querySelector("button");

		if (!element) {
			throw new Error("Button missing");
		}

		const before = element.getBoundingClientRect();
		await act(async () =>
			rerender(
				<Button className='grid w-full grid-cols-[1fr_auto_1fr]' dir={dir} loading size='xl'>
					{content}
				</Button>
			)
		);
		const spinner = element.querySelector("[data-slot='button-loading-indicator'] svg");
		const icon = element.querySelector(":scope > svg");

		if (!(spinner && icon)) {
			throw new Error("Loading content missing");
		}

		const after = element.getBoundingClientRect();
		const bounds = spinner.getBoundingClientRect();
		expect(after.width).toBe(before.width);
		expect(after.height).toBe(before.height);
		expect(Math.abs(bounds.x + bounds.width / 2 - (after.x + after.width / 2))).toBeLessThan(1);
		expect(Math.abs(bounds.y + bounds.height / 2 - (after.y + after.height / 2))).toBeLessThan(1);
		expect(getComputedStyle(icon).opacity).toBe("0");
		expect(getComputedStyle(spinner).color).not.toBe("rgba(0, 0, 0, 0)");
		expect(element).toHaveAccessibleName("Continue with Google Last used");
	});

	it("inherits RTL content direction and reverses tab keyboard navigation", async () => {
		document.documentElement.dir = "rtl";

		const container = await render(
			<DirectionProvider direction='rtl'>
				<Tabs defaultValue='first'>
					<TabsList aria-label='Arabic sections'>
						<TabsTrigger value='first'>First</TabsTrigger>
						<TabsTrigger value='second'>Second</TabsTrigger>
						<TabsTrigger value='third'>Third</TabsTrigger>
					</TabsList>
					<TabsContent value='first'>First panel</TabsContent>
					<TabsContent value='second'>Second panel</TabsContent>
					<TabsContent value='third'>Third panel</TabsContent>
				</Tabs>
			</DirectionProvider>
		);

		const tabs = container.querySelector("[role=tablist]");

		if (!tabs) {
			throw new Error("Tabs missing");
		}

		expect(getComputedStyle(tabs).direction).toBe("rtl");
		await act(async () => page.getByRole("tab", { exact: true, name: "First" }).click());
		await act(async () => userEvent.keyboard("{ArrowLeft}"));
		await expect
			.element(page.getByRole("tab", { exact: true, name: "Second" }))
			.toHaveAttribute("aria-selected", "true");
		await expect.element(page.getByRole("tabpanel")).toHaveTextContent("Second panel");
	});

	it.each(["ltr", "rtl"] as const)("opens the %s drawer at the inline end", async (direction) => {
		document.documentElement.dir = direction;
		await render(
			<DirectionProvider direction={direction}>
				<Drawer position='end'>
					<DrawerTrigger>Open drawer</DrawerTrigger>
					<DrawerPopup>
						<DrawerTitle>Contact</DrawerTitle>
						<DrawerDescription>Contact details</DrawerDescription>
					</DrawerPopup>
				</Drawer>
			</DirectionProvider>
		);
		await act(async () => page.getByRole("button", { name: "Open drawer" }).click());
		await expect.element(page.getByRole("dialog")).toBeVisible();
		await vi.waitFor(() => {
			const popup = document.querySelector("[data-slot=drawer-popup]");

			if (!popup) {
				throw new Error("Drawer missing");
			}

			expect(getComputedStyle(popup).direction).toBe(direction);
			const rect = popup.getBoundingClientRect();
			expect(Math.abs(direction === "rtl" ? rect.left : window.innerWidth - rect.right)).toBeLessThan(1);
			expect(popup.getAttribute("data-swipe-direction")).toBe(direction === "rtl" ? "left" : "right");
		});
		await act(async () => userEvent.keyboard("{Escape}"));
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "Open drawer" })).toHaveFocus();
	});

	it("opens RTL submenus with the left arrow and restores focus after selection", async () => {
		document.documentElement.dir = "rtl";
		const selected = vi.fn();
		await render(
			<DirectionProvider direction='rtl'>
				<DropdownMenu>
					<DropdownMenuTrigger>Actions</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuSub>
							<DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
							<DropdownMenuSubContent>
								<DropdownMenuItem onClick={selected}>Choose</DropdownMenuItem>
							</DropdownMenuSubContent>
						</DropdownMenuSub>
					</DropdownMenuContent>
				</DropdownMenu>
			</DirectionProvider>
		);
		await act(async () => page.getByRole("button", { name: "Actions" }).click());
		await act(async () => userEvent.keyboard("{ArrowDown}{ArrowLeft}"));
		await expect.element(page.getByRole("menuitem", { name: "Choose" })).toBeVisible();
		await act(async () => page.getByRole("menuitem", { name: "Choose" }).click());
		expect(selected).toHaveBeenCalledOnce();
		await expect.element(page.getByRole("button", { name: "Actions" })).toHaveFocus();
	});

	it("selects radio menu items and closes the language menu", async () => {
		const selected = vi.fn();
		await render(
			<DropdownMenu>
				<DropdownMenuTrigger>Language</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuRadioGroup defaultValue='en' onValueChange={selected}>
						<DropdownMenuRadioItem value='en'>English</DropdownMenuRadioItem>
						<DropdownMenuRadioItem closeOnClick value='ar'>
							Arabic
						</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		);
		await act(async () => page.getByRole("button", { name: "Language" }).click());
		await expect
			.element(page.getByRole("menuitemradio", { name: "English" }))
			.toHaveAttribute("aria-checked", "true");
		await act(async () => page.getByRole("menuitemradio", { name: "Arabic" }).click());
		expect(selected.mock.calls[0]?.[0]).toBe("ar");
		await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
	});

	it("opens a navigation popup and follows its rendered link", async () => {
		await render(
			<NavigationMenu>
				<NavigationMenuList>
					<NavigationMenuItem>
						<NavigationMenuTrigger>Products</NavigationMenuTrigger>
						<NavigationMenuContent>
							<NavigationMenuLink href='#product'>Product page</NavigationMenuLink>
						</NavigationMenuContent>
					</NavigationMenuItem>
				</NavigationMenuList>
			</NavigationMenu>
		);
		await act(async () => page.getByRole("button", { name: "Products" }).click());
		await expect.element(page.getByRole("link", { name: "Product page" })).toBeVisible();
		await act(async () => userEvent.keyboard("{Escape}"));
		await expect.element(page.getByRole("link", { name: "Product page" })).not.toBeInTheDocument();
	});

	it("keeps rendered buttons composed as one element and blocks disabled activation", async () => {
		const clicked = vi.fn();

		const container = await render(
			<Button disabled nativeButton={false} onClick={clicked} render={<a href='#disabled' />}>
				Disabled link
			</Button>
		);

		const link = container.querySelector("a");

		if (!link) {
			throw new Error("Rendered link missing");
		}

		expect(container.querySelectorAll("a,button")).toHaveLength(1);
		expect(link.getAttribute("aria-disabled")).toBe("true");
		await act(async () => link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
		expect(clicked).not.toHaveBeenCalled();
	});

	it("opens a dialog, closes it with Escape, and restores trigger focus", async () => {
		await render(
			<Dialog>
				<DialogTrigger>Open dialog</DialogTrigger>
				<DialogPopup>
					<DialogTitle>Account settings</DialogTitle>
					<DialogDescription>Update your account.</DialogDescription>
				</DialogPopup>
			</Dialog>
		);

		const trigger = page.getByRole("button", { name: "Open dialog" });
		await act(async () => trigger.click());
		await expect.element(page.getByRole("dialog")).toBeVisible();
		await act(async () => userEvent.keyboard("{Escape}"));
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
		await expect.element(trigger).toHaveFocus();
	});

	it("supports accordion and tab keyboard interaction", async () => {
		await render(
			<>
				<Accordion multiple={false}>
					<AccordionItem value='details'>
						<AccordionTrigger>Details</AccordionTrigger>
						<AccordionPanel>Expanded content</AccordionPanel>
					</AccordionItem>
				</Accordion>
				<Tabs defaultValue='first'>
					<TabsList aria-label='Sections' size='lg' variant='toggle'>
						<TabsTrigger value='first'>First</TabsTrigger>
						<TabsTrigger value='second'>Second</TabsTrigger>
					</TabsList>
					<TabsContent value='first'>First panel</TabsContent>
					<TabsContent value='second'>Second panel</TabsContent>
				</Tabs>
			</>
		);

		const accordionTrigger = page.getByRole("button", { name: "Details" });
		await act(async () => accordionTrigger.click());
		await expect.element(accordionTrigger).toHaveAttribute("aria-expanded", "true");
		await expect.element(page.getByText("Expanded content")).toBeVisible();

		const firstTab = page.getByRole("tab", { name: "First" });
		await act(async () => firstTab.click());
		await act(async () => userEvent.keyboard("{ArrowRight}"));
		await expect.element(page.getByRole("tab", { name: "Second" })).toHaveAttribute("aria-selected", "true");
		await expect.element(page.getByText("Second panel")).toBeVisible();
	});

	it.each(["line", "area", "bar", "composed", "pie", "radar", "radial"] as const)(
		"renders the Spectrum %s chart at mobile width in RTL",
		async (kind) => {
			document.documentElement.dir = "rtl";

			const container = await render(
				<div style={{ width: 320 }}>
					<SpectrumChart
						ariaLabel='Visitors'
						kind={kind}
						labels={["Sep 20", "Sep 21"]}
						series={[{ category: "Visitors", values: [10, 20] }]}
					/>
				</div>
			);

			await expect
				.poll(() => container.querySelectorAll(".recharts-surface").length, { timeout: 10_000 })
				.toBe(1);
			expect(container.querySelector("svg")?.getBoundingClientRect().width).toBe(320);
			expect(container.querySelector("table")?.textContent).toContain("Sep 21");
			await expect.poll(() => container.querySelectorAll("path").length).toBeGreaterThan(0);
		}
	);
	it("keeps sparklines accessible without visible axes or a background", async () => {
		const container = await render(
			<div style={{ overflowY: "auto", position: "relative", width: 320 }}>
				<div style={{ marginLeft: "auto", width: 120 }}>
					<SpectrumChart
						height={80}
						kind='area'
						labels={["2026-09-20", "2026-09-21"]}
						presentation='sparkline'
						series={[{ category: "Link clicks & enquiries", values: [10, 20] }]}
					/>
				</div>
			</div>
		);

		await expect.poll(() => container.querySelectorAll(".recharts-surface").length).toBe(1);
		expect(container.querySelector(".recharts-cartesian-axis")).toBeNull();
		expect(container.firstElementChild?.scrollWidth).toBe(320);
		expect(container.querySelector("table")?.textContent).toContain("2026-09-21");
		expect(getComputedStyle(container.querySelector(".genui-chart-surface")!).backgroundColor).toBe(
			"rgba(0, 0, 0, 0)"
		);
		const chart = container.querySelector<SVGElement>(".recharts-surface");
		await act(async () => chart?.focus());
		await act(async () => userEvent.keyboard("{ArrowRight}"));
		await expect
			.poll(() => container.querySelector(".recharts-tooltip-wrapper")?.textContent)
			.toContain("Link clicks & enquiries");
	});
});

it("packs composite masonry cards and repacks after content and container resize", async () => {
	const ResizableCard = () => {
		const [expanded, setExpanded] = useState(false);

		return (
			<div data-testid='resizable-card' style={{ height: expanded ? 300 : 80 }}>
				<button onClick={() => setExpanded(!expanded)} type='button'>
					Toggle card height
				</button>
			</div>
		);
	};

	const container = await render(
		<Masonry>
			<div className='h-40' data-testid='first-card' />
			<ResizableCard />
			<div className='h-30' data-testid='last-card' />
		</Masonry>
	);

	container.style.width = "700px";
	const first = container.querySelector('[data-testid="first-card"]')!;
	const second = container.querySelector('[data-testid="resizable-card"]')!;
	const last = container.querySelector('[data-testid="last-card"]')!;
	await expect.poll(() => last.getBoundingClientRect().top - second.getBoundingClientRect().bottom).toBe(16);
	expect(last.getBoundingClientRect().left).toBe(second.getBoundingClientRect().left);
	await act(async () => userEvent.click(page.getByRole("button", { name: "Toggle card height" })));
	await expect.poll(() => last.getBoundingClientRect().top - first.getBoundingClientRect().bottom).toBe(16);
	expect(last.getBoundingClientRect().left).toBe(first.getBoundingClientRect().left);
	container.style.width = "300px";
	await expect.poll(() => last.getBoundingClientRect().top - second.getBoundingClientRect().bottom).toBe(16);
	expect(second.getBoundingClientRect().top - first.getBoundingClientRect().bottom).toBe(16);
	expect(container.scrollWidth).toBe(300);
});
