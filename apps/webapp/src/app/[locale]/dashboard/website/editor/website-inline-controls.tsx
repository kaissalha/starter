"use client";

import { useState, type FormEvent } from "react";

import { ArrowDown01Icon, Link01Icon, Menu01Icon, Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { linkValueSchema, type LinkValue } from "@starter/infinite-website";
import type { SiteLinkElementTarget, SiteMenuItemTarget } from "@starter/infinite-website/preview";
import { Button } from "@starter/ui/components/button";
import { Field, FieldLabel } from "@starter/ui/components/field";
import { Input } from "@starter/ui/components/input";
import { Popover, PopoverDescription, PopoverPopup, PopoverTitle } from "@starter/ui/components/popover";
import { Select, SelectItem, SelectPopup, SelectTrigger } from "@starter/ui/components/select";

import type { WebsiteEditor } from "../use-website-editor";

const linkKinds = ["page", "section", "external", "booking", "relative", "email", "phone", "anchor"] as const;

export type WebsiteLinkOptions = {
	pages: Array<{ id: string; label: string; sections: Array<{ id: string; label: string }> }>;
	sections: Array<{ anchor: string; id: string; label: string }>;
};

type WebsiteLinkEditResult = {
	label?: { pointers: Array<string>; value: string };
	value: LinkValue;
};

const WebsiteLinkEditorIcon = ({ menuRole }: Pick<SiteLinkElementTarget, "menuRole">) => {
	if (menuRole === "dropdown-trigger") {
		return (
			<HugeiconsIcon aria-hidden='true' className='size-4 scale-110' icon={ArrowDown01Icon} strokeWidth={1.75} />
		);
	}

	return menuRole ? (
		<HugeiconsIcon aria-hidden='true' className='size-4 scale-110' icon={Menu01Icon} strokeWidth={1.75} />
	) : (
		<HugeiconsIcon aria-hidden='true' className='size-4 scale-110' icon={Link01Icon} strokeWidth={1.75} />
	);
};

const defaultLink = ({ kind, options }: { kind: LinkValue["kind"]; options: WebsiteLinkOptions }): LinkValue => {
	switch (kind) {
		case "external":
		case "booking":
			return { kind, url: "https://" };
		case "relative":
			return { kind, path: "/" };
		case "page":
			return { kind, pageId: options.pages[0]?.id ?? "" };
		case "section":
			return { kind, sectionId: options.sections[0]?.id ?? "" };
		case "anchor":
			return { anchor: options.sections[0]?.anchor ?? "", kind };
		case "email":
			return { address: "hello@example.com", kind };
		case "phone":
			return { kind, number: "+10000000000" };
	}
};

const WebsiteLinkDestinationField = ({
	destinationLabel,
	id,
	onChange,
	options,
	value,
}: {
	destinationLabel: string;
	id: string;
	onChange: (value: LinkValue) => void;
	options: WebsiteLinkOptions;
	value: LinkValue;
}) => {
	const t = useTranslations("website.inlineEdit.link");

	if (value.kind === "page") {
		const page = options.pages.find(({ id }) => id === value.pageId);

		const sectionLabel = value.sectionId
			? (page?.sections.find(({ id }) => id === value.sectionId)?.label ?? value.sectionId)
			: t("top");

		return (
			<>
				<Field>
					<FieldLabel>{t("page")}</FieldLabel>
					<Select
						onValueChange={(pageId) => pageId && onChange({ kind: "page", pageId })}
						value={value.pageId}
					>
						<SelectTrigger>
							<span className='truncate'>{page?.label ?? value.pageId}</span>
						</SelectTrigger>
						<SelectPopup>
							{options.pages.map((option) => (
								<SelectItem key={option.id} value={option.id}>
									{option.label}
								</SelectItem>
							))}
						</SelectPopup>
					</Select>
				</Field>
				<Field>
					<FieldLabel>{t("pageSection")}</FieldLabel>
					<Select
						onValueChange={(sectionId) => {
							if (!sectionId) {
								return;
							}

							onChange(
								sectionId === "top"
									? { kind: "page", pageId: value.pageId }
									: { kind: "page", pageId: value.pageId, sectionId }
							);
						}}
						value={value.sectionId ?? "top"}
					>
						<SelectTrigger>
							<span className='truncate'>{sectionLabel}</span>
						</SelectTrigger>
						<SelectPopup>
							<SelectItem value='top'>{t("top")}</SelectItem>
							{page?.sections.map((section) => (
								<SelectItem key={section.id} value={section.id}>
									{section.label}
								</SelectItem>
							))}
						</SelectPopup>
					</Select>
				</Field>
			</>
		);
	}

	if (value.kind === "section") {
		const sectionLabel = options.sections.find(({ id }) => id === value.sectionId)?.label ?? value.sectionId;

		return (
			<Field>
				<FieldLabel>{t("section")}</FieldLabel>
				<Select
					onValueChange={(sectionId) => sectionId && onChange({ kind: "section", sectionId })}
					value={value.sectionId}
				>
					<SelectTrigger>
						<span className='truncate'>{sectionLabel}</span>
					</SelectTrigger>
					<SelectPopup>
						{options.sections.map((section) => (
							<SelectItem key={section.id} value={section.id}>
								{section.label}
							</SelectItem>
						))}
					</SelectPopup>
				</Select>
			</Field>
		);
	}

	if (value.kind === "anchor") {
		const sectionLabel = options.sections.find(({ anchor }) => anchor === value.anchor)?.label ?? value.anchor;

		return (
			<Field>
				<FieldLabel>{t("anchor")}</FieldLabel>
				<Select onValueChange={(anchor) => anchor && onChange({ anchor, kind: "anchor" })} value={value.anchor}>
					<SelectTrigger>
						<span className='truncate'>{sectionLabel}</span>
					</SelectTrigger>
					<SelectPopup>
						{options.sections.map((section) => (
							<SelectItem key={section.id} value={section.anchor}>
								{section.label}
							</SelectItem>
						))}
					</SelectPopup>
				</Select>
			</Field>
		);
	}

	const inputValue = (() => {
		switch (value.kind) {
			case "external":
			case "booking":
				return value.url;
			case "relative":
				return value.path;
			case "email":
				return value.address;
			case "phone":
				return value.number;
		}
	})();

	const inputType = (() => {
		if (value.kind === "email") {
			return "email";
		}

		return value.kind === "external" || value.kind === "booking" ? "url" : "text";
	})();

	const updateValue = (nextValue: string) => {
		switch (value.kind) {
			case "external":
			case "booking":
				onChange({ ...value, url: nextValue });

				return;
			case "relative":
				onChange({ ...value, path: nextValue });

				return;
			case "email":
				onChange({ ...value, address: nextValue });

				return;
			case "phone":
				onChange({ ...value, number: nextValue });
		}
	};

	return (
		<Field>
			<FieldLabel htmlFor={id}>{destinationLabel}</FieldLabel>
			<Input
				id={id}
				onChange={(event) => updateValue(event.target.value)}
				required
				type={inputType}
				value={inputValue}
			/>
		</Field>
	);
};

export const WebsiteLinkFields = ({
	destinationLabel,
	id,
	onChange,
	options,
	typeLabel,
	value,
}: {
	destinationLabel: string;
	id: string;
	onChange: (value: LinkValue) => void;
	options: WebsiteLinkOptions;
	typeLabel: string;
	value: LinkValue;
}) => {
	const t = useTranslations("website.inlineEdit.link");

	return (
		<>
			<Field>
				<FieldLabel>{typeLabel}</FieldLabel>
				<Select
					onValueChange={(kind) => {
						const selectedKind = linkKinds.find((candidate) => candidate === kind);

						if (selectedKind) {
							onChange(defaultLink({ kind: selectedKind, options }));
						}
					}}
					value={value.kind}
				>
					<SelectTrigger>
						<span className='truncate'>{t(`types.${value.kind}`)}</span>
					</SelectTrigger>
					<SelectPopup>
						{linkKinds.map((kind) => (
							<SelectItem key={kind} value={kind}>
								{t(`types.${kind}`)}
							</SelectItem>
						))}
					</SelectPopup>
				</Select>
			</Field>
			<WebsiteLinkDestinationField
				destinationLabel={destinationLabel}
				id={id}
				onChange={onChange}
				options={options}
				value={value}
			/>
		</>
	);
};

export const WebsiteLinkEditor = ({
	anchor,
	disabled,
	onClose,
	onSave,
	options,
	target,
}: {
	anchor: HTMLElement;
	disabled: boolean;
	onClose: () => void;
	onSave: ({ label, value }: WebsiteLinkEditResult) => void;
	options: WebsiteLinkOptions;
	target: SiteLinkElementTarget;
}) => {
	const t = useTranslations("website.inlineEdit.link");
	const [value, setValue] = useState(target.value);
	const [label, setLabel] = useState(target.labels[0]?.content ?? "");
	const [invalid, setInvalid] = useState(false);

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const parsed = linkValueSchema.safeParse(value);

		if (!event.currentTarget.reportValidity() || !parsed.success) {
			setInvalid(true);

			return;
		}

		onClose();

		const result: WebsiteLinkEditResult = { value: parsed.data };

		if (target.labels.length > 0 && label !== (target.labels[0]?.content ?? "")) {
			result.label = { pointers: target.labels.map(({ pointer }) => pointer), value: label };
		}

		onSave(result);
	};

	return (
		<Popover onOpenChange={(open) => !open && onClose()} open>
			<PopoverPopup
				align='start'
				anchor={anchor}
				className='w-88 max-w-[calc(100vw-1rem)]'
				side='bottom'
				sideOffset={8}
				stacked
			>
				<div className='flex items-start gap-3'>
					<span className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground'>
						<WebsiteLinkEditorIcon menuRole={target.menuRole} />
					</span>
					<div>
						<PopoverTitle>{t("title")}</PopoverTitle>
						<PopoverDescription className='mt-1'>{t("description")}</PopoverDescription>
					</div>
				</div>
				<form className='space-y-4' onSubmit={submit}>
					{target.labels.length > 0 && (
						<Field>
							<FieldLabel htmlFor='website-link-label'>
								{t(target.elementType === "action" ? "buttonText" : "linkText")}
							</FieldLabel>
							<Input
								id='website-link-label'
								maxLength={20_000}
								onChange={(event) => setLabel(event.target.value)}
								required
								value={label}
							/>
						</Field>
					)}
					<WebsiteLinkFields
						destinationLabel={t("destination")}
						id='website-link-destination'
						onChange={(nextValue) => {
							setInvalid(false);
							setValue(nextValue);
						}}
						options={options}
						typeLabel={t("type")}
						value={value}
					/>
					{invalid && (
						<p className='text-xs text-destructive-foreground' role='alert'>
							{t("invalid")}
						</p>
					)}
					<div className='flex gap-3 border-t pt-4'>
						<Button
							className='min-w-0 flex-1'
							onClick={onClose}
							size='lg'
							type='button'
							variant='secondary'
						>
							{t("cancel")}
						</Button>
						<Button className='min-w-0 flex-1' disabled={disabled} size='lg' type='submit'>
							{t("save")}
						</Button>
					</div>
				</form>
			</PopoverPopup>
		</Popover>
	);
};

type WebsiteMenuDropdownItemEdit = { id: string; label: string; value: LinkValue };

type WebsiteMenuItemEditResult = {
	items: Array<WebsiteMenuDropdownItemEdit>;
	kind: "dropdown" | "link";
	label: string;
	value: LinkValue;
};

const WebsiteMenuDropdownItems = ({
	disabled,
	items,
	onChange,
	options,
}: {
	disabled: boolean;
	items: Array<WebsiteMenuDropdownItemEdit>;
	onChange: (items: Array<WebsiteMenuDropdownItemEdit>) => void;
	options: WebsiteLinkOptions;
}) => {
	const t = useTranslations("website.inlineEdit.link");
	const tMenu = useTranslations("website.inlineEdit.menu.item");
	const { can } = useOrganizationPermissions();

	return (
		<div className='space-y-3'>
			<div className='flex items-center justify-between gap-3'>
				<p className='text-sm font-medium'>{tMenu("items")}</p>
				<Button
					disabled={disabled || items.length >= 12}
					onClick={() =>
						onChange([
							...items,
							{
								id: crypto.randomUUID(),
								label: tMenu("newItem"),
								value: defaultLink({ kind: "page", options }),
							},
						])
					}
					size='sm'
					type='button'
					variant='outline'
				>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Add01Icon} strokeWidth={1.75} />
					{tMenu("addItem")}
				</Button>
			</div>
			{items.map((item, index) => (
				<div className='space-y-3 rounded-xl border border-border p-3' key={item.id}>
					<div className='flex items-center justify-between gap-3'>
						<p className='text-xs font-medium text-muted-foreground'>
							{tMenu("item", { number: index + 1 })}
						</p>
						<Button
							aria-label={tMenu("removeItem")}
							disabled={disabled || !can("workspace.delete")}
							onClick={() => onChange(items.filter(({ id }) => id !== item.id))}
							size='icon-sm'
							title={tMenu("removeItem")}
							type='button'
							variant='destructive-ghost'
						>
							<HugeiconsIcon
								aria-hidden='true'
								className='scale-110'
								icon={Delete02Icon}
								strokeWidth={1.75}
							/>
						</Button>
					</div>
					<Field>
						<FieldLabel htmlFor={`website-menu-dropdown-label-${item.id}`}>{tMenu("itemLabel")}</FieldLabel>
						<Input
							id={`website-menu-dropdown-label-${item.id}`}
							maxLength={20_000}
							onChange={(event) =>
								onChange(
									items.map((candidate) =>
										candidate.id === item.id
											? { ...candidate, label: event.target.value }
											: candidate
									)
								)
							}
							required
							value={item.label}
						/>
					</Field>
					<WebsiteLinkFields
						destinationLabel={t("destination")}
						id={`website-menu-dropdown-destination-${item.id}`}
						onChange={(nextValue) => {
							onChange(
								items.map((candidate) =>
									candidate.id === item.id ? { ...candidate, value: nextValue } : candidate
								)
							);
						}}
						options={options}
						typeLabel={t("type")}
						value={item.value}
					/>
				</div>
			))}
		</div>
	);
};

export const WebsiteMenuItemEditor = ({
	anchor,
	disabled,
	onClose,
	onDelete,
	onSave,
	options,
	target,
}: {
	anchor: HTMLElement;
	disabled: boolean;
	onClose: () => void;
	onDelete: () => void;
	onSave: (result: WebsiteMenuItemEditResult) => void;
	options: WebsiteLinkOptions;
	target: SiteMenuItemTarget;
}) => {
	const t = useTranslations("website.inlineEdit.link");
	const tMenu = useTranslations("website.inlineEdit.menu.item");
	const { can } = useOrganizationPermissions();
	const [kind, setKind] = useState<WebsiteMenuItemEditResult["kind"]>(target.items.length > 0 ? "dropdown" : "link");
	const [label, setLabel] = useState(target.labels[0]?.content ?? "");
	const [value, setValue] = useState(target.value);

	const [items, setItems] = useState(() =>
		target.items.map((item) => ({
			id: item.elementId,
			label: item.labels[0]?.content ?? "",
			value: item.value,
		}))
	);

	const [invalid, setInvalid] = useState(false);

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const validLinks =
			linkValueSchema.safeParse(value).success &&
			items.every((item) => linkValueSchema.safeParse(item.value).success);

		const validItems = kind === "link" || items.length > 0;

		if (!event.currentTarget.reportValidity() || !validLinks || !validItems) {
			setInvalid(true);

			return;
		}

		onClose();
		onSave({ items: kind === "dropdown" ? items : [], kind, label, value });
	};

	return (
		<Popover onOpenChange={(open) => !open && onClose()} open>
			<PopoverPopup
				align='start'
				anchor={anchor}
				className='max-h-[min(44rem,var(--available-height))] w-[26rem] max-w-[calc(100vw-1rem)] overflow-y-auto'
				padding='none'
				side='bottom'
				sideOffset={8}
			>
				<div className='flex items-start gap-3 border-b border-border p-4'>
					<span className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground'>
						<WebsiteLinkEditorIcon
							menuRole={kind === "dropdown" ? "dropdown-trigger" : "navigation-item"}
						/>
					</span>
					<div>
						<PopoverTitle>{tMenu("title")}</PopoverTitle>
						<PopoverDescription className='mt-1'>{tMenu("description")}</PopoverDescription>
					</div>
				</div>
				<form className='space-y-4 p-4' onSubmit={submit}>
					<Field>
						<FieldLabel htmlFor='website-menu-item-label'>{tMenu("label")}</FieldLabel>
						<Input
							id='website-menu-item-label'
							maxLength={20_000}
							onChange={(event) => setLabel(event.target.value)}
							required
							value={label}
						/>
					</Field>
					<Field>
						<FieldLabel>{tMenu("kind")}</FieldLabel>
						<Select
							onValueChange={(nextKind) => {
								if (nextKind === "link" || nextKind === "dropdown") {
									setInvalid(false);
									setKind(nextKind);

									if (nextKind === "dropdown" && items.length === 0) {
										setItems([
											{
												id: crypto.randomUUID(),
												label: tMenu("newItem"),
												value: defaultLink({ kind: "page", options }),
											},
										]);
									}
								}
							}}
							value={kind}
						>
							<SelectTrigger>
								<span className='truncate'>{tMenu(`kinds.${kind}`)}</span>
							</SelectTrigger>
							<SelectPopup>
								<SelectItem value='link'>{tMenu("kinds.link")}</SelectItem>
								<SelectItem value='dropdown'>{tMenu("kinds.dropdown")}</SelectItem>
							</SelectPopup>
						</Select>
					</Field>
					<WebsiteLinkFields
						destinationLabel={kind === "dropdown" ? tMenu("fallbackDestination") : t("destination")}
						id='website-menu-item-destination'
						onChange={(nextValue) => {
							setInvalid(false);
							setValue(nextValue);
						}}
						options={options}
						typeLabel={kind === "dropdown" ? tMenu("fallbackType") : t("type")}
						value={value}
					/>
					{kind === "dropdown" && (
						<WebsiteMenuDropdownItems
							disabled={disabled}
							items={items}
							onChange={(nextItems) => {
								setInvalid(false);
								setItems(nextItems);
							}}
							options={options}
						/>
					)}
					{invalid && (
						<p className='text-xs text-destructive-foreground' role='alert'>
							{kind === "dropdown" && items.length === 0 ? tMenu("needsItem") : t("invalid")}
						</p>
					)}
					<div className='flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4'>
						<Button
							disabled={disabled || !can("workspace.delete")}
							onClick={() => {
								onClose();
								onDelete();
							}}
							type='button'
							variant='destructive-ghost'
						>
							<HugeiconsIcon
								aria-hidden='true'
								className='scale-110'
								icon={Delete02Icon}
								strokeWidth={1.75}
							/>
							{tMenu("remove")}
						</Button>
						<div className='flex w-full gap-3'>
							<Button
								className='min-w-0 flex-1'
								onClick={onClose}
								size='lg'
								type='button'
								variant='secondary'
							>
								{t("cancel")}
							</Button>
							<Button className='min-w-0 flex-1' disabled={disabled} size='lg' type='submit'>
								{tMenu("save")}
							</Button>
						</div>
					</div>
				</form>
			</PopoverPopup>
		</Popover>
	);
};

export const WebsiteActiveLinkEditor = ({
	editor,
	onClose,
	options,
	state,
}: {
	editor: Pick<WebsiteEditor, "disabled" | "edit" | "pending">;
	onClose: () => void;
	options: WebsiteLinkOptions;
	state: { anchor: HTMLElement; target: SiteLinkElementTarget } | null;
}) => {
	if (!state) {
		return null;
	}

	const disabled = editor.disabled || editor.pending !== null;
	const menuItem = state.target.menuItem;

	if (menuItem) {
		return (
			<WebsiteMenuItemEditor
				anchor={state.anchor}
				disabled={disabled}
				key={menuItem.elementId}
				onClose={onClose}
				onDelete={() => {
					editor.edit({
						elementId: menuItem.elementId,
						operation: "delete-menu-item",
						sectionId: menuItem.sectionId,
					});
				}}
				onSave={({ items, kind, label, value }) => {
					editor.edit({
						elementId: menuItem.elementId,
						items,
						kind,
						label,
						locale: menuItem.locale,
						operation: "update-menu-item",
						sectionId: menuItem.sectionId,
						value,
					});
				}}
				options={options}
				target={menuItem}
			/>
		);
	}

	return (
		<WebsiteLinkEditor
			anchor={state.anchor}
			disabled={disabled}
			key={`${state.target.elementId}:${state.target.pointer}`}
			onClose={onClose}
			onSave={({ label, value }) => {
				editor.edit({
					label,
					locale: state.target.locale,
					operation: "update-link",
					pointer: state.target.pointer,
					sectionId: state.target.sectionId,
					value,
				});
			}}
			options={options}
			target={state.target}
		/>
	);
};
