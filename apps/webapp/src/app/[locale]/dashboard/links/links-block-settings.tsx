"use client";

import type { PointerEvent } from "react";

import { ArrowDown02Icon, ArrowUp02Icon, DragDropVerticalIcon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Reorder, useDragControls } from "motion/react";
import { useTranslations } from "next-intl";

import { MediaPicker } from "@/components/media/media-picker";
import {
	LinkPageSocialIcon,
	linkPageCollectionDisplays,
	linkPageSocialDisplays,
	linkPageLimits,
	linkPageLinkLayouts,
	linkPageSocialPlatformLabels,
	type LinkPageBlock,
	type LinkPageCollectionBlock,
	type LinkPageLink,
	type LinkPageSocial,
	type LinkPageSocialsBlock,
} from "@starter/infinite-links";
import { Button } from "@starter/ui/components/button";
import { Field, FieldError, FieldLabel } from "@starter/ui/components/field";
import { Input } from "@starter/ui/components/input";
import { Switch } from "@starter/ui/components/switch";
import { Textarea } from "@starter/ui/components/textarea";

import { LinksExtraBlockFields, LinksLinkExtras } from "./links-block-settings-extra";
import { createLinkPageTextButton } from "./links-document-operations";
import { LinksFieldGroup, LinksSegmented, LinksTilePicker } from "./links-option-controls";
import { LinksAddButton, LinksDraftFooter, LinksFieldset, LinksPanel } from "./links-panel";
import { LinksSectionDesign } from "./links-section-design";
import type { LinksPageController } from "./use-links-page-controller";

type BlockOf<Kind extends LinkPageBlock["kind"]> = Extract<LinkPageBlock, { kind: Kind }>;

const DragHandle = ({
	label,
	onPointerDown,
}: {
	label: string;
	onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
}) => (
	<Button
		aria-label={label}
		className='cursor-grab touch-none active:cursor-grabbing'
		data-base-ui-swipe-ignore=''
		onPointerDown={onPointerDown}
		size='icon-sm'
		title={label}
		type='button'
		variant='ghost'
	>
		<HugeiconsIcon aria-hidden='true' className='scale-110' icon={DragDropVerticalIcon} strokeWidth={1.75} />
	</Button>
);

const UrlField = ({
	id,
	invalid,
	label,
	onChange,
	placeholder = "https://",
	value,
}: {
	id: string;
	invalid?: boolean;
	label: string;
	onChange: (value: string) => void;
	placeholder?: string;
	value: string;
}) => {
	const t = useTranslations("links.editor");

	return (
		<Field invalid={invalid} name={id}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Input
				aria-describedby={invalid ? `${id}-error` : undefined}
				aria-invalid={invalid || undefined}
				dir='ltr'
				id={id}
				inputMode='url'
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				type='text'
				value={value}
			/>
			{invalid && (
				<FieldError id={`${id}-error`} match role='alert'>
					{t("invalidUrl")}
				</FieldError>
			)}
		</Field>
	);
};

const LinkFields = ({
	controller,
	id,
	invalid,
	link,
	onUpdate,
	showLayout = true,
}: {
	controller: LinksPageController;
	id: string;
	invalid: boolean;
	link: LinkPageLink;
	onUpdate: (update: (link: LinkPageLink) => LinkPageLink) => void;
	showLayout?: boolean;
}) => {
	const t = useTranslations("links.editor");

	return (
		<>
			<UrlField
				id={`${id}-url`}
				invalid={invalid}
				label={t("url")}
				onChange={(url) => onUpdate((current) => ({ ...current, url }))}
				value={link.url}
			/>
			<MediaPicker
				kind='image'
				label={t("imageUrl")}
				onRemove={() => onUpdate((current) => ({ ...current, imageUrl: null }))}
				onSelect={(media) => onUpdate((current) => ({ ...current, imageUrl: media.url }))}
				previewUrl={link.imageUrl}
			/>
			<LinksFieldGroup label={t("badge")}>
				<Input
					aria-label={t("badge")}
					maxLength={linkPageLimits.buttonLabel}
					onChange={(event) =>
						onUpdate((current) => ({
							...current,
							badge: { ...current.badge, [controller.locale]: event.target.value },
						}))
					}
					placeholder={t("badgePlaceholder")}
					value={link.badge?.[controller.locale] ?? ""}
				/>
			</LinksFieldGroup>
			<LinksFieldGroup label={t("linkDescription")}>
				<Textarea
					aria-label={t("linkDescription")}
					maxLength={linkPageLimits.bio}
					onChange={(event) =>
						onUpdate((current) => ({
							...current,
							description: { ...current.description, [controller.locale]: event.target.value },
						}))
					}
					value={link.description?.[controller.locale] ?? ""}
				/>
			</LinksFieldGroup>
			{showLayout &&
				!(link.design ?? (link.appearance.buttons ?? controller.document.appearance.buttons).design) && (
					<LinksFieldGroup label={t("layout")}>
						<LinksTilePicker
							label={t("layout")}
							onChange={(layout) => onUpdate((current) => ({ ...current, layout }))}
							options={linkPageLinkLayouts.map((layout) => ({
								description: t(`layouts.${layout}Description`),
								label: t(`layouts.${layout}`),
								preview: (
									<span
										className={`${layout === "classic" ? "h-7" : "h-16"} w-28 rounded-lg bg-foreground/80`}
									/>
								),
								value: layout,
							}))}
							value={link.layout}
						/>
					</LinksFieldGroup>
				)}
			<LinksLinkExtras id={id} link={link} locale={controller.locale} onUpdate={onUpdate} />
		</>
	);
};

const SocialRow = ({
	blockId,
	controller,
	social,
}: {
	blockId: string;
	controller: LinksPageController;
	social: LinkPageSocial;
}) => {
	const t = useTranslations("links.editor");
	const controls = useDragControls();
	const isEmail = social.platform === "email";
	const value = isEmail ? social.url.replace(/^mailto:/iu, "") : social.url;

	return (
		<Reorder.Item
			className='flex items-center gap-2 bg-background py-2'
			dragControls={controls}
			dragListener={false}
			value={social.id}
		>
			<DragHandle label={t("drag")} onPointerDown={(event) => controls.start(event)} />
			<span
				className='flex size-9 shrink-0 items-center justify-center text-foreground'
				title={linkPageSocialPlatformLabels[social.platform]}
			>
				<LinkPageSocialIcon className='size-4' platform={social.platform} />
			</span>
			<Input
				aria-label={`${linkPageSocialPlatformLabels[social.platform]} · ${isEmail ? t("socialEmail") : t("socialUrl")}`}
				className='min-w-0 flex-1'
				dir='ltr'
				inputMode={isEmail ? "email" : "url"}
				onChange={(event) =>
					controller.updateSocial({
						blockId,
						id: social.id,
						update: (current) => ({
							...current,
							url: isEmail ? `mailto:${event.target.value}` : event.target.value,
						}),
					})
				}
				placeholder={isEmail ? "you@example.com" : "https://"}
				type={isEmail ? "email" : "url"}
				value={value}
			/>
			<Button
				aria-label={t("removeSocial")}
				disabled={!controller.can("workspace.delete")}
				onClick={() => controller.removeSocial({ blockId, id: social.id })}
				size='icon-sm'
				type='button'
				variant='ghost'
			>
				<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Delete02Icon} strokeWidth={1.75} />
			</Button>
		</Reorder.Item>
	);
};

const SocialsFields = ({ block, controller }: { block: LinkPageSocialsBlock; controller: LinksPageController }) => {
	const t = useTranslations("links.editor");

	return (
		<LinksFieldset description={t("socialsDescription")}>
			<LinksSegmented
				label={t("socialDisplay")}
				onChange={(display) =>
					controller.updateBlock({
						id: block.id,
						kind: "socials",
						update: (current) => ({ ...current, display }),
					})
				}
				options={linkPageSocialDisplays.map((value) => ({ label: t(`socialDisplays.${value}`), value }))}
				value={block.display ?? "icons"}
			/>
			{block.items.length > 0 && (
				<Reorder.Group
					axis='y'
					className='divide-y'
					onReorder={(orderedIds: Array<string>) =>
						controller.reorderSocials({ blockId: block.id, orderedIds })
					}
					values={block.items.map((social) => social.id)}
				>
					{block.items.map((social) => (
						<SocialRow blockId={block.id} controller={controller} key={social.id} social={social} />
					))}
				</Reorder.Group>
			)}
			<LinksAddButton
				disabled={block.items.length >= linkPageLimits.socials}
				label={t("addSocial")}
				onClick={() => controller.setView({ id: block.id, kind: "add-social" })}
			/>
		</LinksFieldset>
	);
};

const RedirectSwitch = ({ controller, linkId }: { controller: LinksPageController; linkId: string }) => {
	const t = useTranslations("links.editor");
	const active = controller.document.redirectBlockId === linkId;

	return (
		<div className='flex items-center justify-between gap-4'>
			<p className='text-sm text-muted-foreground'>{t("redirectDescription")}</p>
			<Switch
				aria-label={t("redirect")}
				checked={active}
				onCheckedChange={(checked) => controller.setRedirect({ blockId: checked ? linkId : null })}
			/>
		</div>
	);
};

const CollectionLinkCard = ({
	collectionId,
	controller,
	link,
	order,
	showLayout,
}: {
	collectionId: string;
	controller: LinksPageController;
	link: LinkPageLink;
	order: Array<string>;
	showLayout: boolean;
}) => {
	const t = useTranslations("links.editor");
	const controls = useDragControls();
	const locale = controller.locale;
	const index = order.indexOf(link.id);

	const update = (updater: (link: LinkPageLink) => LinkPageLink) =>
		controller.updateCollectionLink({ collectionId, linkId: link.id, update: updater });

	const move = (offset: -1 | 1) =>
		controller.reorderCollectionLinks({
			collectionId,
			orderedIds: order.map((id, position) => {
				if (position === index) {
					return order[index + offset] ?? id;
				}

				return position === index + offset ? link.id : id;
			}),
		});

	return (
		<Reorder.Item
			className='bg-background py-4 first:pt-0'
			dragControls={controls}
			dragListener={false}
			value={link.id}
		>
			<div className='flex items-center gap-2'>
				<DragHandle label={t("drag")} onPointerDown={(event) => controls.start(event)} />
				<span className='min-w-0 flex-1 truncate text-sm font-medium'>
					{link.label[locale] || t("kinds.link")}
				</span>
				<Button
					aria-label={t("blockActions.moveUp")}
					disabled={index <= 0}
					onClick={() => move(-1)}
					size='icon-sm'
					type='button'
					variant='ghost'
				>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={ArrowUp02Icon} strokeWidth={1.75} />
				</Button>
				<Button
					aria-label={t("blockActions.moveDown")}
					disabled={index === order.length - 1}
					onClick={() => move(1)}
					size='icon-sm'
					type='button'
					variant='ghost'
				>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={ArrowDown02Icon} strokeWidth={1.75} />
				</Button>
				<Button
					aria-label={t("remove")}
					disabled={!controller.can("workspace.delete")}
					onClick={() => controller.removeCollectionLink({ collectionId, linkId: link.id })}
					size='icon-sm'
					type='button'
					variant='ghost'
				>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Delete02Icon} strokeWidth={1.75} />
				</Button>
			</div>
			<div className='mt-3 space-y-4'>
				<LinkFields
					controller={controller}
					id={`link-${link.id}`}
					invalid={controller.invalidBlockIds.has(link.id)}
					link={link}
					onUpdate={update}
					showLayout={showLayout}
				/>
			</div>
		</Reorder.Item>
	);
};

const CollectionFields = ({
	block,
	controller,
}: {
	block: LinkPageCollectionBlock;
	controller: LinksPageController;
}) => {
	const t = useTranslations("links.editor");

	const update = (updater: (block: LinkPageCollectionBlock) => LinkPageBlock) =>
		controller.updateBlock({ id: block.id, kind: "collection", update: updater });

	return (
		<>
			<LinksFieldset>
				{!(block.design ?? (block.appearance.buttons ?? controller.document.appearance.buttons).design) && (
					<LinksFieldGroup label={t("display")}>
						<LinksTilePicker
							columns={3}
							label={t("display")}
							onChange={(display) => update((current) => ({ ...current, display }))}
							options={linkPageCollectionDisplays.map((display) => ({
								label: t(`displays.${display}`),
								preview: (
									<span
										className={
											display === "stack"
												? "flex w-full flex-col gap-1.5 px-1"
												: "grid w-full grid-cols-2 gap-1.5 px-1"
										}
									>
										<span className='h-5 rounded-md bg-foreground/75' />
										<span className='h-5 rounded-md bg-foreground/55' />
										{display !== "carousel" && <span className='h-5 rounded-md bg-foreground/35' />}
									</span>
								),
								value: display,
							}))}
							previewClassName='min-h-20'
							value={block.display}
						/>
					</LinksFieldGroup>
				)}
				<div className='flex items-center justify-between gap-4'>
					<p className='text-sm text-muted-foreground'>{t("collapsibleDescription")}</p>
					<Switch
						aria-label={t("collapsible")}
						checked={block.collapsible === true}
						onCheckedChange={(collapsible) => update((current) => ({ ...current, collapsible }))}
					/>
				</div>
			</LinksFieldset>
			<LinksFieldset legend={t("collectionLinks")}>
				<Reorder.Group
					axis='y'
					className='divide-y'
					onReorder={(orderedIds: Array<string>) =>
						controller.reorderCollectionLinks({ collectionId: block.id, orderedIds })
					}
					values={block.links.map((link) => link.id)}
				>
					{block.links.map((link) => (
						<CollectionLinkCard
							collectionId={block.id}
							controller={controller}
							key={link.id}
							link={link}
							order={block.links.map((candidate) => candidate.id)}
							showLayout={
								!(
									block.design ??
									(block.appearance.buttons ?? controller.document.appearance.buttons).design
								)
							}
						/>
					))}
				</Reorder.Group>
				<LinksAddButton
					disabled={block.links.length >= linkPageLimits.collectionLinks}
					label={t("addLink")}
					onClick={() => controller.addCollectionLink({ collectionId: block.id })}
				/>
			</LinksFieldset>
		</>
	);
};

const TextFields = ({ block, controller }: { block: BlockOf<"text">; controller: LinksPageController }) => {
	const t = useTranslations("links.editor");

	const update = (updater: (block: BlockOf<"text">) => LinkPageBlock) =>
		controller.updateBlock({ id: block.id, kind: "text", update: updater });

	const button = block.button;

	return (
		<LinksFieldset legend={t("button")}>
			<div className='flex items-center justify-between gap-4'>
				<p className='text-sm text-muted-foreground'>{t("buttonDescription")}</p>
				<Switch
					aria-label={t("button")}
					checked={button !== null}
					onCheckedChange={(checked) =>
						update((current) => ({
							...current,
							button: checked ? createLinkPageTextButton({ locales: controller.locales }) : null,
						}))
					}
				/>
			</div>
			{button && (
				<UrlField
					id={`block-${block.id}-button-url`}
					label={t("buttonUrl")}
					onChange={(url) => update((current) => ({ ...current, button: { ...button, url } }))}
					value={button.url}
				/>
			)}
		</LinksFieldset>
	);
};

const BlockFields = ({ block, controller }: { block: LinkPageBlock; controller: LinksPageController }) => {
	const t = useTranslations("links.editor");
	const invalid = controller.invalidBlockIds.has(block.id);

	switch (block.kind) {
		case "collection":
			return <CollectionFields block={block} controller={controller} />;
		case "header":
			return null;
		case "link":
			return (
				<>
					<LinksFieldset>
						<LinkFields
							controller={controller}
							id={`block-${block.id}`}
							invalid={invalid}
							link={block}
							onUpdate={(update) => controller.updateBlock({ id: block.id, kind: "link", update })}
						/>
					</LinksFieldset>
					<LinksFieldset legend={t("redirect")}>
						<RedirectSwitch controller={controller} linkId={block.id} />
					</LinksFieldset>
				</>
			);
		case "text":
			return <TextFields block={block} controller={controller} />;
		case "socials":
			return <SocialsFields block={block} controller={controller} />;
		case "announcement":
		case "countdown":
		case "embed":
		case "faq":
		case "form":
		case "marquee":
		case "tabs":
		case "testimonials":
			return <LinksExtraBlockFields block={block} controller={controller} />;
		case "video":
			return (
				<LinksFieldset>
					<MediaPicker
						kind='video'
						onSelect={(media) =>
							controller.updateBlock({
								id: block.id,
								kind: "video",
								update: (current) => ({ ...current, url: media.url }),
							})
						}
					/>
					<UrlField
						id={`block-${block.id}-video`}
						invalid={invalid}
						label={t("videoUrl")}
						onChange={(url) =>
							controller.updateBlock({
								id: block.id,
								kind: "video",
								update: (current) => ({ ...current, url }),
							})
						}
						placeholder='https://www.youtube.com/watch?v=…'
						value={block.url}
					/>
				</LinksFieldset>
			);
	}
};

export const LinksBlockPanel = ({ block, controller }: { block: LinkPageBlock; controller: LinksPageController }) => {
	const t = useTranslations("links.editor");
	const invalid = controller.invalidBlockIds.has(block.id);

	return (
		<LinksPanel
			footer={
				<LinksDraftFooter
					dirty={controller.viewDirty && !invalid}
					onCancel={controller.cancelView}
					onDone={() => controller.setView({ kind: "root" })}
				/>
			}
			onBack={controller.cancelView}
			title={t(`kinds.${block.kind}`)}
		>
			{invalid && (
				<p className='rounded-xl bg-destructive/8 px-4 py-3 text-sm text-destructive' role='alert'>
					{t("invalid")}
				</p>
			)}
			<BlockFields block={block} controller={controller} />
			<LinksSectionDesign block={block} controller={controller} />
		</LinksPanel>
	);
};
