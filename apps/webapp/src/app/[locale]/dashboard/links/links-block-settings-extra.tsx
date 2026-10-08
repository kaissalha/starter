"use client";

import type { ReactNode } from "react";

import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import {
	linkPageAnnouncementLayouts,
	linkPageFormFieldTypes,
	linkPageLinkAligns,
	linkPageLinkAnimations,
	linkPageMarqueeStyles,
	linkPageTabsStyles,
	type LinkPageBlock,
	type LinkPageLink,
} from "@starter/infinite-links";
import { Button } from "@starter/ui/components/button";
import { Field, FieldLabel } from "@starter/ui/components/field";
import { Input } from "@starter/ui/components/input";
import { Switch } from "@starter/ui/components/switch";
import { Textarea } from "@starter/ui/components/textarea";

import { LinksColorList, LinksColorRow, LinksRatioSlider, LinksSegmented } from "./links-option-controls";
import { LinksAddButton, LinksFieldset } from "./links-panel";
import type { LinksPageController } from "./use-links-page-controller";

type BlockOf<Kind extends LinkPageBlock["kind"]> = Extract<LinkPageBlock, { kind: Kind }>;

type Localized = Partial<Record<string, string>>;

const TextField = ({
	id,
	label,
	multiline = false,
	onChange,
	value,
}: {
	id: string;
	label: string;
	multiline?: boolean;
	onChange: (value: string) => void;
	value: string;
}) => (
	<Field name={id}>
		<FieldLabel htmlFor={id}>{label}</FieldLabel>
		{multiline ? (
			<Textarea id={id} onChange={(event) => onChange(event.target.value)} rows={3} value={value} />
		) : (
			<Input id={id} onChange={(event) => onChange(event.target.value)} type='text' value={value} />
		)}
	</Field>
);

const RemoveButton = ({ disabled, label, onClick }: { disabled: boolean; label: string; onClick: () => void }) => (
	<Button aria-label={label} disabled={disabled} onClick={onClick} size='icon-sm' type='button' variant='ghost'>
		<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Delete02Icon} strokeWidth={1.75} />
	</Button>
);

const useBlockEditor = <Kind extends LinkPageBlock["kind"]>(controller: LinksPageController, block: BlockOf<Kind>) => {
	const { locale } = controller;

	return {
		locale,
		localized: (copy: Localized, value: string) => ({ ...copy, [locale]: value }),
		update: (updater: (current: BlockOf<Kind>) => BlockOf<Kind>) =>
			controller.updateBlock({ id: block.id, kind: block.kind, update: updater }),
	};
};

const ItemList = <Item extends { id: string }>({
	addLabel,
	canRemove,
	items,
	onAdd,
	onRemove,
	removeLabel,
	render,
}: {
	addLabel: string;
	canRemove: boolean;
	items: Array<Item>;
	onAdd: () => void;
	onRemove: (id: string) => void;
	removeLabel: string;
	render: (item: Item) => ReactNode;
}) => (
	<div className='grid gap-3'>
		<div className='divide-y'>
			{items.map((item) => (
				<div className='space-y-3 py-4 first:pt-0' key={item.id}>
					<div className='flex justify-end'>
						<RemoveButton
							disabled={!canRemove || items.length === 1}
							label={removeLabel}
							onClick={() => onRemove(item.id)}
						/>
					</div>
					{render(item)}
				</div>
			))}
		</div>
		<LinksAddButton label={addLabel} onClick={onAdd} />
	</div>
);

const ItemsFieldset = <Kind extends LinkPageBlock["kind"], Item extends { id: string }>({
	addLabel,
	block,
	controller,
	create,
	get,
	legend,
	render,
	set,
}: {
	addLabel: string;
	block: BlockOf<Kind>;
	controller: LinksPageController;
	create: () => Item;
	get: (block: BlockOf<Kind>) => Array<Item>;
	legend: string;
	render: (item: Item, edit: (patch: (item: Item) => Item) => void) => ReactNode;
	set: (block: BlockOf<Kind>, items: Array<Item>) => BlockOf<Kind>;
}) => {
	const t = useTranslations("links.editor");
	const { update } = useBlockEditor(controller, block);

	const setItems = (next: (items: Array<Item>) => Array<Item>) =>
		update((current) => set(current, next(get(current))));

	return (
		<LinksFieldset legend={legend}>
			<ItemList
				addLabel={addLabel}
				canRemove={controller.can("workspace.delete")}
				items={get(block)}
				onAdd={() => setItems((items) => [...items, create()])}
				onRemove={(id) => setItems((items) => items.filter((item) => item.id !== id))}
				removeLabel={t("remove")}
				render={(item) =>
					render(item, (patch) =>
						setItems((items) =>
							items.map((candidate) => (candidate.id === item.id ? patch(candidate) : candidate))
						)
					)
				}
			/>
		</LinksFieldset>
	);
};

const TabsFields = ({ block, controller }: { block: BlockOf<"tabs">; controller: LinksPageController }) => {
	const t = useTranslations("links.editor");
	const { locale, localized, update } = useBlockEditor(controller, block);

	return (
		<>
			<LinksFieldset>
				<LinksSegmented
					label={t("tabsStyle")}
					onChange={(style) => update((current) => ({ ...current, style }))}
					options={linkPageTabsStyles.map((style) => ({ label: t(`tabsStyles.${style}`), value: style }))}
					value={block.style ?? "pills"}
				/>
			</LinksFieldset>
			<ItemsFieldset
				addLabel={t("addTab")}
				block={block}
				controller={controller}
				create={() => ({ id: crypto.randomUUID(), label: { [locale]: t("tab") }, url: "/" })}
				get={(current) => current.items}
				legend={t("tabs")}
				render={(item, edit) => (
					<>
						<TextField
							id={`tab-${item.id}-label`}
							label={t("tabLabel")}
							onChange={(value) =>
								edit((current) => ({ ...current, label: localized(current.label, value) }))
							}
							value={item.label[locale] ?? ""}
						/>
						<TextField
							id={`tab-${item.id}-url`}
							label={t("url")}
							onChange={(url) => edit((current) => ({ ...current, url }))}
							value={item.url}
						/>
					</>
				)}
				set={(current, items) => ({ ...current, items })}
			/>
		</>
	);
};

const FormFields = ({ block, controller }: { block: BlockOf<"form">; controller: LinksPageController }) => {
	const t = useTranslations("links.editor");
	const { locale, localized, update } = useBlockEditor(controller, block);

	return (
		<>
			<LinksFieldset>
				<TextField
					id={`form-${block.id}-action`}
					label={t("formAction")}
					onChange={(action) => update((current) => ({ ...current, action }))}
					value={block.action}
				/>
				<TextField
					id={`form-${block.id}-submit`}
					label={t("submitLabel")}
					onChange={(value) =>
						update((current) => ({ ...current, submitLabel: localized(current.submitLabel, value) }))
					}
					value={block.submitLabel[locale] ?? ""}
				/>
			</LinksFieldset>
			<ItemsFieldset
				addLabel={t("addField")}
				block={block}
				controller={controller}
				create={(): BlockOf<"form">["fields"][number] => ({
					id: crypto.randomUUID(),
					label: { [locale]: t("fieldTypes.text") },
					required: false,
					type: "text",
				})}
				get={(current) => current.fields}
				legend={t("formFields")}
				render={(field, edit) => (
					<>
						<TextField
							id={`field-${field.id}-label`}
							label={t("fieldLabel")}
							onChange={(value) =>
								edit((current) => ({ ...current, label: localized(current.label, value) }))
							}
							value={field.label[locale] ?? ""}
						/>
						<LinksSegmented
							label={t("fieldType")}
							onChange={(type) => edit((current) => ({ ...current, type }))}
							options={linkPageFormFieldTypes.map((type) => ({
								label: t(`fieldTypes.${type}`),
								value: type,
							}))}
							value={field.type}
						/>
						<label className='flex items-center justify-between gap-3 text-sm font-medium'>
							{t("required")}
							<Switch
								checked={field.required}
								onCheckedChange={(required) => edit((current) => ({ ...current, required }))}
							/>
						</label>
					</>
				)}
				set={(current, fields) => ({ ...current, fields })}
			/>
		</>
	);
};

const MarqueeFields = ({ block, controller }: { block: BlockOf<"marquee">; controller: LinksPageController }) => {
	const t = useTranslations("links.editor");
	const { update } = useBlockEditor(controller, block);

	return (
		<LinksFieldset>
			<LinksSegmented
				label={t("marqueeStyle")}
				onChange={(style) => update((current) => ({ ...current, style }))}
				options={linkPageMarqueeStyles.map((style) => ({ label: t(`marqueeStyles.${style}`), value: style }))}
				value={block.style}
			/>
			<LinksRatioSlider
				label={t("marqueeSpeed")}
				onChange={(speed) => update((current) => ({ ...current, speed }))}
				value={block.speed}
			/>
			<TextField
				id={`marquee-${block.id}-separator`}
				label={t("marqueeSeparator")}
				onChange={(separator) => update((current) => ({ ...current, separator: separator.slice(0, 4) }))}
				value={block.separator}
			/>
			<label className='flex items-center justify-between gap-3 text-sm font-medium'>
				{t("uppercase")}
				<Switch
					checked={block.uppercase}
					onCheckedChange={(uppercase) => update((current) => ({ ...current, uppercase }))}
				/>
			</label>
			<LinksColorList>
				<LinksColorRow
					label={t("marqueeRibbonColor")}
					onChange={(ribbon) =>
						update((current) => ({
							...current,
							colors: ribbon ? { ribbon, text: current.colors?.text ?? "#000000" } : null,
						}))
					}
					value={block.colors?.ribbon ?? null}
				/>
				<LinksColorRow
					label={t("marqueeTextColor")}
					onChange={(text) =>
						update((current) => ({
							...current,
							colors: text ? { ribbon: current.colors?.ribbon ?? "#ffffff", text } : null,
						}))
					}
					value={block.colors?.text ?? null}
				/>
			</LinksColorList>
		</LinksFieldset>
	);
};

const AnnouncementFields = ({
	block,
	controller,
}: {
	block: BlockOf<"announcement">;
	controller: LinksPageController;
}) => {
	const t = useTranslations("links.editor");
	const { locale, localized, update } = useBlockEditor(controller, block);

	return (
		<LinksFieldset>
			<LinksSegmented
				label={t("announcementLayout")}
				onChange={(layout) => update((current) => ({ ...current, layout }))}
				options={linkPageAnnouncementLayouts.map((layout) => ({
					label: t(`announcementLayouts.${layout}`),
					value: layout,
				}))}
				value={block.layout}
			/>
			<TextField
				id={`announcement-${block.id}-title`}
				label={t("sectionText")}
				onChange={(value) => update((current) => ({ ...current, title: localized(current.title, value) }))}
				value={block.title[locale] ?? ""}
			/>
			<TextField
				id={`announcement-${block.id}-description`}
				label={t("linkDescription")}
				onChange={(value) =>
					update((current) => ({ ...current, description: localized(current.description, value) }))
				}
				value={block.description[locale] ?? ""}
			/>
			<TextField
				id={`announcement-${block.id}-button`}
				label={t("buttonUrl")}
				onChange={(url) =>
					update((current) => ({
						...current,
						button: url ? { label: current.button?.label ?? { [locale]: t("learnMore") }, url } : null,
					}))
				}
				value={block.button?.url ?? ""}
			/>
			<LinksColorList>
				<LinksColorRow
					label={t("sectionBackground")}
					onChange={(background) =>
						update((current) => ({
							...current,
							colors: background ? { background, text: current.colors?.text ?? "#ffffff" } : null,
						}))
					}
					value={block.colors?.background ?? null}
				/>
				<LinksColorRow
					label={t("sectionText")}
					onChange={(text) =>
						update((current) => ({
							...current,
							colors: text ? { background: current.colors?.background ?? "#000000", text } : null,
						}))
					}
					value={block.colors?.text ?? null}
				/>
			</LinksColorList>
		</LinksFieldset>
	);
};

const FaqFields = ({ block, controller }: { block: BlockOf<"faq">; controller: LinksPageController }) => {
	const t = useTranslations("links.editor");
	const { locale, localized } = useBlockEditor(controller, block);

	return (
		<ItemsFieldset
			addLabel={t("addQuestion")}
			block={block}
			controller={controller}
			create={() => ({
				answer: { [locale]: t("answer") },
				id: crypto.randomUUID(),
				question: { [locale]: t("question") },
			})}
			get={(current) => current.items}
			legend={t("faqItems")}
			render={(item, edit) => (
				<>
					<TextField
						id={`faq-${item.id}-question`}
						label={t("question")}
						onChange={(value) =>
							edit((current) => ({ ...current, question: localized(current.question, value) }))
						}
						value={item.question[locale] ?? ""}
					/>
					<TextField
						id={`faq-${item.id}-answer`}
						label={t("answer")}
						multiline
						onChange={(value) =>
							edit((current) => ({ ...current, answer: localized(current.answer, value) }))
						}
						value={item.answer[locale] ?? ""}
					/>
				</>
			)}
			set={(current, items) => ({ ...current, items })}
		/>
	);
};

const TestimonialsFields = ({
	block,
	controller,
}: {
	block: BlockOf<"testimonials">;
	controller: LinksPageController;
}) => {
	const t = useTranslations("links.editor");
	const { locale, localized } = useBlockEditor(controller, block);

	return (
		<ItemsFieldset
			addLabel={t("addTestimonial")}
			block={block}
			controller={controller}
			create={() => ({
				company: {},
				id: crypto.randomUUID(),
				imageUrl: null,
				name: { [locale]: t("reviewerName") },
				quote: { [locale]: t("quote") },
				url: null,
			})}
			get={(current) => current.items}
			legend={t("testimonialItems")}
			render={(item, edit) => (
				<>
					<TextField
						id={`review-${item.id}-name`}
						label={t("reviewerName")}
						onChange={(value) => edit((current) => ({ ...current, name: localized(current.name, value) }))}
						value={item.name[locale] ?? ""}
					/>
					<TextField
						id={`review-${item.id}-company`}
						label={t("reviewerCompany")}
						onChange={(value) =>
							edit((current) => ({ ...current, company: localized(current.company, value) }))
						}
						value={item.company[locale] ?? ""}
					/>
					<TextField
						id={`review-${item.id}-quote`}
						label={t("quote")}
						multiline
						onChange={(value) =>
							edit((current) => ({ ...current, quote: localized(current.quote, value) }))
						}
						value={item.quote[locale] ?? ""}
					/>
					<TextField
						id={`review-${item.id}-url`}
						label={t("url")}
						onChange={(url) => edit((current) => ({ ...current, url: url || null }))}
						value={item.url ?? ""}
					/>
				</>
			)}
			set={(current, items) => ({ ...current, items })}
		/>
	);
};

const toLocalInput = (iso: string) => {
	const date = new Date(iso);

	return Number.isNaN(date.getTime())
		? ""
		: new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const CountdownFields = ({ block, controller }: { block: BlockOf<"countdown">; controller: LinksPageController }) => {
	const t = useTranslations("links.editor");
	const { locale, localized, update } = useBlockEditor(controller, block);

	return (
		<LinksFieldset>
			<Field name={`countdown-${block.id}-ends`}>
				<FieldLabel htmlFor={`countdown-${block.id}-ends`}>{t("endsAt")}</FieldLabel>
				<Input
					id={`countdown-${block.id}-ends`}
					onChange={(event) => {
						const date = new Date(event.target.value);

						if (!Number.isNaN(date.getTime())) {
							update((current) => ({ ...current, endsAt: date.toISOString() }));
						}
					}}
					type='datetime-local'
					value={toLocalInput(block.endsAt)}
				/>
			</Field>
			<TextField
				id={`countdown-${block.id}-ended`}
				label={t("endedMessage")}
				onChange={(value) =>
					update((current) => ({ ...current, endedMessage: localized(current.endedMessage, value) }))
				}
				value={block.endedMessage[locale] ?? ""}
			/>
		</LinksFieldset>
	);
};

const animationOptions = ["none", ...linkPageLinkAnimations] as const;

export const LinksLinkExtras = ({
	id,
	link,
	locale,
	onUpdate,
}: {
	id: string;
	link: LinkPageLink;
	locale: string;
	onUpdate: (update: (link: LinkPageLink) => LinkPageLink) => void;
}) => {
	const t = useTranslations("links.editor");

	return (
		<>
			<TextField
				id={`${id}-cta`}
				label={t("linkCta")}
				onChange={(value) =>
					onUpdate((current) => ({
						...current,
						cta: value ? { ...current.cta, [locale]: value } : undefined,
					}))
				}
				value={link.cta?.[locale] ?? ""}
			/>
			<TextField
				id={`${id}-emoji`}
				label={t("linkEmoji")}
				onChange={(value) =>
					onUpdate((current) => ({ ...current, emoji: value.trim() ? value.trim().slice(0, 8) : undefined }))
				}
				value={link.emoji ?? ""}
			/>
			<LinksSegmented
				label={t("linkAlign")}
				onChange={(align) => onUpdate((current) => ({ ...current, align }))}
				options={linkPageLinkAligns.map((align) => ({ label: t(`sectionAlignments.${align}`), value: align }))}
				value={link.align ?? "center"}
			/>
			<LinksSegmented
				label={t("linkAnimation")}
				onChange={(animation) =>
					onUpdate((current) => ({ ...current, animation: animation === "none" ? undefined : animation }))
				}
				options={animationOptions.map((animation) => ({
					label: t(`linkAnimations.${animation}`),
					value: animation,
				}))}
				value={link.animation ?? "none"}
			/>
		</>
	);
};

export const LinksExtraBlockFields = ({
	block,
	controller,
}: {
	block: LinkPageBlock;
	controller: LinksPageController;
}) => {
	const t = useTranslations("links.editor");

	switch (block.kind) {
		case "announcement":
			return <AnnouncementFields block={block} controller={controller} />;
		case "countdown":
			return <CountdownFields block={block} controller={controller} />;
		case "embed":
			return (
				<LinksFieldset>
					<TextField
						id={`embed-${block.id}-url`}
						label={t("embedUrl")}
						onChange={(url) =>
							controller.updateBlock({
								id: block.id,
								kind: "embed",
								update: (current) => ({ ...current, url }),
							})
						}
						value={block.url}
					/>
				</LinksFieldset>
			);
		case "faq":
			return <FaqFields block={block} controller={controller} />;
		case "form":
			return <FormFields block={block} controller={controller} />;
		case "marquee":
			return <MarqueeFields block={block} controller={controller} />;
		case "tabs":
			return <TabsFields block={block} controller={controller} />;
		case "testimonials":
			return <TestimonialsFields block={block} controller={controller} />;
		default:
			return null;
	}
};
