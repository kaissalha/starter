"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { Add01Icon, ArrowUp02Icon, ArrowDown02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import type { Iso6391LanguageCode, SiteDocument, SiteSection } from "@starter/infinite-website";
import {
	listSectionMenus,
	listSectionLinkElementReferences,
	resolveSectionContentReference,
	linkValueSchema,
	type LinkValue,
} from "@starter/infinite-website/editing";
import { Button } from "@starter/ui/components/button";
import { Field, FieldLabel } from "@starter/ui/components/field";
import { Input } from "@starter/ui/components/input";
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "@starter/ui/components/popover";
import { cn } from "@starter/ui/lib/utils";

import type { WebsiteEditor } from "../use-website-editor";
import { WebsiteBlogVisibility } from "./website-blog-visibility";
import { WebsiteLinkFields, type WebsiteLinkOptions } from "./website-inline-controls";

export type WebsiteHeaderMenuContext = {
	document: SiteDocument;
	locale: Iso6391LanguageCode;
	options: WebsiteLinkOptions;
};

export const WebsiteHeaderMenu = ({
	context,
	disabled,
	edit,
	pending,
	root,
	section,
}: {
	context: WebsiteHeaderMenuContext;
	disabled: boolean;
	edit: WebsiteEditor["edit"];
	pending: WebsiteEditor["pending"];
	root: RefObject<HTMLDivElement | null>;
	section: SiteSection;
}) => {
	const t = useTranslations("website.inlineEdit.menu.item");
	const controlsDisabled = disabled || pending !== null;
	const [open, setOpen] = useState(false);
	const savedSection = context.document.structure.layout.header.find(({ id }) => id === section.id) ?? section;
	const menu = listSectionMenus({ node: savedSection.root })[0];
	const references = listSectionLinkElementReferences({ node: savedSection.root });
	const control = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const header = root.current;
		const button = control.current;

		if (!header || !button) {
			return;
		}

		const navigation = header.querySelector<HTMLElement>("[data-website-layout-occupied='navigation']");
		const brand = header.querySelector<HTMLElement>("[data-website-layout-occupied='brand']");
		const actions = header.querySelector<HTMLElement>("[data-website-layout-occupied='actions']");

		const synchronize = () => {
			const bounds = header.getBoundingClientRect();
			const nav = navigation?.querySelector("a, button") ? navigation.getBoundingClientRect() : undefined;

			const anchor = [nav, actions?.getBoundingClientRect(), brand?.getBoundingClientRect()].find(
				(rect) => rect && rect.width > 0
			);

			const layout = header.querySelector<HTMLElement>(".iw-layout")?.getBoundingClientRect() ?? bounds;

			const item =
				navigation?.querySelector<HTMLElement>("a, button") ??
				actions?.querySelector<HTMLElement>("a, button") ??
				brand;

			if (item) {
				button.style.color = getComputedStyle(item).color;
			}

			const rtl = getComputedStyle(header).direction === "rtl";

			const occupied = [brand, actions]
				.flatMap((element) => (element ? [element.getBoundingClientRect()] : []))
				.filter((rect) => rect.width > 0);

			const width = button.offsetWidth;
			const candidates = anchor ? [anchor.left - width - 8, anchor.right + 8] : [];

			if (rtl) {
				candidates.reverse();
			}

			const left = candidates.find(
				(x) =>
					x >= bounds.left + 8 &&
					x + width <= bounds.right - 8 &&
					occupied.every((rect) => x + width + 8 <= rect.left || x - 8 >= rect.right)
			);

			button.style.left = `${left === undefined ? Math.max(8, bounds.width - width - 12) : left - bounds.left}px`;
			button.dataset.positioned = "";
			button.style.top = `${left === undefined || !anchor ? layout.bottom - bounds.top + 4 : anchor.top - bounds.top + (anchor.height - button.offsetHeight) / 2}px`;
		};

		synchronize();
		const observer = new ResizeObserver(synchronize);
		[header, navigation, brand, actions, button].forEach((element) => element && observer.observe(element));

		return () => observer.disconnect();
	}, [menu?.props.items.length, root, section.root]);

	if (!menu) {
		return null;
	}

	return (
		<>
			<WebsiteBlogVisibility
				disabled={controlsDisabled}
				edit={edit}
				hidden={context.document.blogNavigationHidden === true}
				renderedSection={section}
				root={root}
			/>
			<div
				className={cn(
					"invisible absolute z-[60] transition-opacity data-[positioned]:visible [@media(hover:hover)]:opacity-0 group-focus-within/website-section:opacity-100 group-hover/website-section:opacity-100 motion-reduce:transition-none",
					open && "opacity-100"
				)}
				ref={control}
			>
				<Popover onOpenChange={setOpen} open={open}>
					<PopoverTrigger
						render={
							<Button
								aria-label={t("add")}
								borderStyle='dashed'
								disabled={controlsDisabled}
								size='icon'
								title={t("add")}
								variant='inherit'
							/>
						}
					>
						<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Add01Icon} strokeWidth={1.75} />
					</PopoverTrigger>
					<PopoverPopup align='end' className='w-80 max-w-[calc(100vw-2rem)]' sideOffset={8}>
						<PopoverTitle>{t("manage")}</PopoverTitle>
						<div className='my-3 space-y-2'>
							{menu.props.items.map((item, index) => {
								const reference = references.find(({ elementId }) => elementId === item.id)?.labels[0];

								const label = reference
									? String(
											resolveSectionContentReference({
												content: context.document.content,
												contentId: section.contentId,
												defaultLocale: context.document.defaultLocale,
												locale: context.locale,
												reference: { $text: reference.pointer },
											})
										)
									: t("newItem");

								return (
									<div className='flex items-center gap-2' key={item.id}>
										<span className='min-w-0 flex-1 truncate'>{label}</span>
										{([-1, 1] as const).map((direction) => (
											<Button
												aria-label={t(direction === -1 ? "moveUp" : "moveDown", { label })}
												disabled={
													disabled ||
													index + direction < 0 ||
													index + direction >= menu.props.items.length
												}
												key={direction}
												onClick={() =>
													edit({
														elementId: item.id,
														index: index + direction,
														operation: "move-menu-item",
														sectionId: section.id,
													})
												}
												size='icon-sm'
												variant='ghost'
											>
												<HugeiconsIcon
													aria-hidden='true'
													className='scale-110'
													icon={direction === -1 ? ArrowUp02Icon : ArrowDown02Icon}
													strokeWidth={1.75}
												/>
											</Button>
										))}
									</div>
								);
							})}
						</div>
						<WebsiteHeaderMenuForm
							context={context}
							disabled={controlsDisabled}
							onAdd={async ({ label, value }) => {
								const result = await edit({
									elementId: crypto.randomUUID(),
									index: menu.props.items.length,
									label,
									locale: context.locale,
									menuId: menu.id,
									operation: "add-menu-item",
									sectionId: section.id,
									value,
								});

								if (result) {
									setOpen(false);
								}
							}}
						/>
					</PopoverPopup>
				</Popover>
			</div>
		</>
	);
};

const WebsiteHeaderMenuForm = ({
	context,
	disabled,
	onAdd,
}: {
	context: WebsiteHeaderMenuContext;
	disabled: boolean;
	onAdd: (item: { label: string; value: LinkValue }) => Promise<void>;
}) => {
	const t = useTranslations("website.inlineEdit.menu.item");
	const tLink = useTranslations("website.inlineEdit.link");
	const [label, setLabel] = useState("");

	const [value, setValue] = useState<LinkValue>({
		kind: "page",
		pageId: context.document.structure.pages[0]?.id ?? "",
	});

	return (
		<form
			className='space-y-3 border-t border-border pt-3'
			onSubmit={(event) => {
				event.preventDefault();

				if (label.trim() && linkValueSchema.safeParse(value).success) {
					onAdd({ label: label.trim(), value });
				}
			}}
		>
			<Field>
				<FieldLabel htmlFor='header-menu-label'>{t("label")}</FieldLabel>
				<Input
					id='header-menu-label'
					maxLength={20_000}
					onChange={(event) => setLabel(event.target.value)}
					required
					value={label}
				/>
			</Field>
			<WebsiteLinkFields
				destinationLabel={tLink("destination")}
				id='header-menu-destination'
				onChange={setValue}
				options={context.options}
				typeLabel={tLink("type")}
				value={value}
			/>
			<Button
				className='w-full'
				disabled={disabled || !label.trim() || !linkValueSchema.safeParse(value).success}
				type='submit'
			>
				{t("add")}
			</Button>
		</form>
	);
};
