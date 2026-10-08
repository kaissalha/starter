"use client";

import {
	createContext,
	use,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type PointerEvent,
	type ReactNode,
} from "react";

import { ArrowDown02Icon, ArrowUp02Icon, Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import { useShallow } from "zustand/react/shallow";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import type { SitePreviewSectionProps, SitePreviewSectionTarget } from "@starter/infinite-website/preview";
import { Button } from "@starter/ui/components/button";
import { cn } from "@starter/ui/lib/utils";

import { ConfirmDestructiveEdit } from "../../components/editor/confirm-destructive-edit";
import {
	selectWebsiteEditorLocked,
	type SectionInsertionTarget,
	useWebsiteGenerationStore,
} from "../generation/website-generation-store";
import type { WebsiteEditor } from "../use-website-editor";
import { WebsiteHeaderMenu, type WebsiteHeaderMenuContext } from "./website-header-menu";
import { WebsiteMediaButton } from "./website-media-panel";
import { synchronizeWebsitePreviewImages } from "./website-preview-images";

type WebsiteSectionControls = Pick<WebsiteEditor, "disabled" | "edit" | "openOverlay" | "pending"> & {
	headerMenu?: WebsiteHeaderMenuContext;
	nestedEditingSectionId?: string | undefined;
	openAgent: (sectionId?: string) => void;
	openSectionCatalog: ({ target }: { target: SectionInsertionTarget }) => void;
};

const WebsiteSectionActionsContext = createContext<WebsiteSectionControls | null>(null);

const websiteEditorHeaderBlockSize = "--website-editor-header-block-size";

const websiteEditorHeaderDesignPosition = "--website-editor-header-design-position";

const resolveWebsiteEditorHeaderGap = ({
	firstBounds,
	rootBounds,
	secondBounds,
}: {
	firstBounds: DOMRect | undefined;
	rootBounds: DOMRect;
	secondBounds: DOMRect | undefined;
}) => {
	if (!firstBounds?.width || !secondBounds?.width) {
		return undefined;
	}

	if (firstBounds.right <= secondBounds.left) {
		return {
			position: (firstBounds.right + secondBounds.left) / 2 - rootBounds.left,
			width: secondBounds.left - firstBounds.right,
		};
	}

	if (secondBounds.right <= firstBounds.left) {
		return {
			position: (secondBounds.right + firstBounds.left) / 2 - rootBounds.left,
			width: firstBounds.left - secondBounds.right,
		};
	}

	return undefined;
};

const resolveWebsiteEditorHeaderDesignPosition = ({
	actionsBounds,
	brandBounds,
	navigationBounds,
	rootBounds,
}: {
	actionsBounds: DOMRect | undefined;
	brandBounds: DOMRect | undefined;
	navigationBounds: DOMRect | undefined;
	rootBounds: DOMRect;
}) => {
	const brandNavigationGap = resolveWebsiteEditorHeaderGap({
		firstBounds: brandBounds,
		rootBounds,
		secondBounds: navigationBounds,
	});

	const navigationActionsGap = resolveWebsiteEditorHeaderGap({
		firstBounds: navigationBounds,
		rootBounds,
		secondBounds: actionsBounds,
	});

	if (navigationActionsGap && (!brandNavigationGap || navigationActionsGap.width > brandNavigationGap.width)) {
		return navigationActionsGap.position;
	}

	if (brandNavigationGap) {
		return brandNavigationGap.position;
	}

	return rootBounds.width / 2;
};

const synchronizeWebsiteEditorHeaderBlockSize = (element: HTMLElement) => {
	const container = element.closest<HTMLElement>(".website-container");

	if (!container) {
		return;
	}

	const containerBounds = container.getBoundingClientRect();

	const headerBlockEnd = Math.max(
		containerBounds.top,
		...Array.from(container.querySelectorAll<HTMLElement>("[data-area='header'] > div > .iw-layout")).map(
			(header) => header.getBoundingClientRect().bottom
		)
	);

	container.style.setProperty(websiteEditorHeaderBlockSize, `${Math.ceil(headerBlockEnd - containerBounds.top)}px`);
};

const synchronizeWebsiteEditorHeaderDesignPosition = (element: HTMLElement) => {
	const rootBounds = element.getBoundingClientRect();

	const actionsBounds = element
		.querySelector<HTMLElement>("[data-website-layout-occupied='actions']")
		?.getBoundingClientRect();

	const brandBounds = element
		.querySelector<HTMLElement>("[data-website-layout-occupied='brand']")
		?.getBoundingClientRect();

	const navigationBounds = element
		.querySelector<HTMLElement>("[data-website-layout-occupied='navigation']")
		?.getBoundingClientRect();

	const position = resolveWebsiteEditorHeaderDesignPosition({
		actionsBounds,
		brandBounds,
		navigationBounds,
		rootBounds,
	});

	const edgeInset = Math.min(48, rootBounds.width / 2);
	const clampedPosition = Math.min(Math.max(position, edgeInset), rootBounds.width - edgeInset);
	element.style.setProperty(websiteEditorHeaderDesignPosition, `${Math.round(clampedPosition)}px`);
};

export const WebsiteSectionControlsProvider = ({
	children,
	editor,
	headerMenu,
	nestedEditingSectionId,
	openAgent,
	openSectionCatalog,
}: {
	children: ReactNode;
	editor: Pick<WebsiteEditor, "disabled" | "edit" | "openOverlay" | "pending">;
	headerMenu?: WebsiteHeaderMenuContext;
	nestedEditingSectionId?: string | undefined;
	openAgent: WebsiteSectionControls["openAgent"];
	openSectionCatalog: WebsiteSectionControls["openSectionCatalog"];
}) => {
	const value = useMemo(
		() => ({
			disabled: editor.disabled,
			edit: editor.edit,
			headerMenu,
			nestedEditingSectionId,
			openAgent,
			openOverlay: editor.openOverlay,
			openSectionCatalog,
			pending: editor.pending,
		}),
		[
			headerMenu,
			editor.disabled,
			editor.edit,
			editor.openOverlay,
			editor.pending,
			nestedEditingSectionId,
			openAgent,
			openSectionCatalog,
		]
	);

	return <WebsiteSectionActionsContext value={value}>{children}</WebsiteSectionActionsContext>;
};

const WebsitePageSectionControls = ({
	controls,
	editorLocked,
	hasBehavior,
	sectionId,
	target,
}: {
	controls: WebsiteSectionControls;
	editorLocked: boolean;
	hasBehavior: boolean;
	sectionId: string;
	target: Extract<SitePreviewSectionTarget, { area: "page" }>;
}) => {
	const t = useTranslations("website");
	const { can } = useOrganizationPermissions();
	const { disabled, edit, openAgent, openOverlay, pending } = controls;
	const pendingOperation = pending?.sectionId === sectionId ? pending.operation : null;
	const controlsDisabled = editorLocked || disabled || pending !== null;
	const input = { pageId: target.pageId, sectionId };
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	return (
		<div className='pointer-events-none sticky inset-x-0 top-[var(--website-editor-header-block-size,0px)] z-50 h-0'>
			<div
				aria-label={t("sectionActions.toolbar")}
				className={cn(
					"absolute end-3 top-3 flex origin-top -translate-y-2 scale-95 opacity-0 transition-[opacity,transform] duration-200 ease-out",
					"group-focus-within/website-section:pointer-events-auto group-focus-within/website-section:translate-y-0 group-focus-within/website-section:scale-100 group-focus-within/website-section:opacity-100",
					"md:[@media(pointer:fine)]:group-hover/website-section:pointer-events-auto md:[@media(pointer:fine)]:group-hover/website-section:translate-y-0 md:[@media(pointer:fine)]:group-hover/website-section:scale-100 md:[@media(pointer:fine)]:group-hover/website-section:opacity-100",
					"motion-reduce:transition-none"
				)}
				role='toolbar'
			>
				<div className='flex overflow-hidden rounded-2xl bg-popover p-1 smooth-shadow-ring-md'>
					<WebsiteMediaButton disabled={controlsDisabled} openOverlay={openOverlay} target={{ sectionId }} />
					<Button
						disabled={controlsDisabled}
						onClick={() => {
							if (hasBehavior) {
								openAgent(sectionId);

								return;
							}

							openOverlay({
								kind: "layout",
								target: { area: "page", index: target.index, pageId: target.pageId, sectionId },
							});
						}}
						size='default'
						type='button'
						variant='ghost'
					>
						{t(hasBehavior ? "sectionActions.aiEdit" : "sectionActions.design")}
					</Button>
					<Button
						aria-label={t("sectionActions.moveUp")}

						disabled={controlsDisabled || target.index === 0}
						loading={pendingOperation === "move-up"}
						onClick={() => edit({ ...input, operation: "move-up" })}
						size='icon'
						title={t("sectionActions.moveUp")}
						type='button'
						variant='ghost'
					>
						<HugeiconsIcon
							aria-hidden='true'
							className='scale-110'
							icon={ArrowUp02Icon}
							strokeWidth={1.75}
						/>
					</Button>
					<Button
						aria-label={t("sectionActions.moveDown")}

						disabled={controlsDisabled || target.index === target.sectionCount - 1}
						loading={pendingOperation === "move-down"}
						onClick={() => edit({ ...input, operation: "move-down" })}
						size='icon'
						title={t("sectionActions.moveDown")}
						type='button'
						variant='ghost'
					>
						<HugeiconsIcon
							aria-hidden='true'
							className='scale-110'
							icon={ArrowDown02Icon}
							strokeWidth={1.75}
						/>
					</Button>
					<Button
						aria-label={t("sectionActions.delete")}

						disabled={controlsDisabled || !can("workspace.delete")}
						loading={pendingOperation === "delete"}
						onClick={() => setConfirmingDelete(true)}
						size='icon'
						title={t("sectionActions.delete")}
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
			</div>
			<ConfirmDestructiveEdit
				confirmLabel={t("sectionActions.delete")}
				description={t("sectionActions.deleteDescription")}
				onConfirm={() => edit({ ...input, operation: "delete" })}
				onOpenChange={setConfirmingDelete}
				open={confirmingDelete}
				title={t("sectionActions.deleteTitle")}
			/>
		</div>
	);
};

const WebsiteSectionInsertionControl = ({
	controls,
	edge,
	editorLocked,
	target,
}: {
	controls: WebsiteSectionControls;
	edge: "bottom" | "top";
	editorLocked: boolean;
	target: SectionInsertionTarget;
}) => {
	const t = useTranslations("website.sectionCatalog");

	return (
		<div className={cn("pointer-events-none absolute inset-x-0 z-40 h-0", edge === "top" ? "top-0" : "bottom-0")}>
			<div className='absolute inset-x-0 top-0 flex h-8 -translate-y-1/2 items-center justify-center'>
				<div
					aria-hidden='true'
					className='absolute inset-x-0 h-0.5 bg-[var(--color-selection)] opacity-0 transition-opacity duration-150 ease-out group-focus-within/website-section:opacity-100 [@media(hover:hover)]:group-hover/website-section:opacity-100 motion-reduce:transition-none'
				/>
				<span className='pointer-events-auto pointer-coarse:invisible pointer-coarse:group-focus-within/website-section:visible'>
					<Button
						disabled={editorLocked || controls.disabled || controls.pending !== null}
						onClick={() => controls.openSectionCatalog({ target })}
						revealOnHover
						size='xs'
						type='button'
						variant='insertion'
					>
						<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Add01Icon} strokeWidth={1.75} />
						{t("add")}
					</Button>
				</span>
			</div>
		</div>
	);
};

const WebsiteLayoutSectionControls = ({
	controls,
	editorLocked,
	sectionId,
	target,
}: {
	controls: WebsiteSectionControls;
	editorLocked: boolean;
	sectionId: string;
	target: Extract<SitePreviewSectionTarget, { area: "footer" | "header" }>;
}) => {
	const t = useTranslations("website");

	if (controls.nestedEditingSectionId === sectionId) {
		return null;
	}

	const controlsDisabled = editorLocked || controls.disabled || controls.pending !== null;
	const footer = target.area === "footer";

	return (
		<div className='pointer-events-none absolute inset-x-0 top-0 z-50 h-0' data-website-layout-controls=''>
			<div
				aria-label={t("sectionActions.toolbar")}
				className={cn(
					"absolute top-3 flex translate-y-4 opacity-0 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
					"group-focus-within/website-section:pointer-events-auto group-focus-within/website-section:translate-y-0 group-focus-within/website-section:opacity-100",
					"md:[@media(pointer:fine)]:group-hover/website-section:pointer-events-auto md:[@media(pointer:fine)]:group-hover/website-section:translate-y-0 md:[@media(pointer:fine)]:group-hover/website-section:opacity-100",
					footer ? "end-3 origin-top" : "-translate-x-1/2"
				)}
				role='toolbar'
				style={footer ? undefined : { left: `var(${websiteEditorHeaderDesignPosition}, 50%)` }}
			>
				<div className='flex overflow-hidden rounded-[20px] bg-popover p-1 smooth-shadow-ring-md'>
					<WebsiteMediaButton
						disabled={controlsDisabled}
						openOverlay={controls.openOverlay}
						target={{ sectionId }}
					/>
					<Button
						disabled={controlsDisabled}
						onClick={() =>
							controls.openOverlay({
								kind: "layout",
								target: { area: target.area, index: target.index, sectionId },
							})
						}
						size='lg'
						type='button'
						variant='ghost'
					>
						{t("sectionActions.design")}
					</Button>
				</div>
			</div>
		</div>
	);
};

const focusWebsitePreviewSection = (event: PointerEvent<HTMLDivElement>) => {
	if (
		window.matchMedia("(max-width: 767px), (pointer: coarse)").matches &&
		!event.currentTarget.contains(document.activeElement)
	) {
		event.currentTarget.focus({ preventScroll: true });
	}
};

export const WebsitePreviewSection = ({ children, hasLogic, section, target }: SitePreviewSectionProps) => {
	const root = useRef<HTMLDivElement>(null);
	const controls = use(WebsiteSectionActionsContext);

	const { activePageId, activePageSectionCount, assetVersion, editorLocked, readiness } = useWebsiteGenerationStore(
		useShallow((state) => {
			const readiness = state.readiness[section.id];

			const activePage =
				target.area === "footer"
					? (state.snapshot?.document.structure.pages.find((page) => page.id === state.pageId) ??
						state.snapshot?.document.structure.pages.find((page) => page.home))
					: undefined;

			return {
				activePageId: activePage?.id,
				activePageSectionCount: activePage?.sections.length,
				assetVersion:
					readiness?.assetIds.map((assetId) => state.snapshot?.assets[assetId]?.src ?? "").join("\u0000") ??
					"",
				editorLocked: selectWebsiteEditorLocked(state),
				readiness,
			};
		})
	);

	useLayoutEffect(() => {
		const element = root.current;

		if (!element) {
			return;
		}

		synchronizeWebsitePreviewImages({ element, sectionId: section.id });
	}, [assetVersion, readiness, section.id]);

	useLayoutEffect(() => {
		const element = root.current;

		if (!element || target.area !== "header" || target.index !== 0) {
			return;
		}

		const container = element.closest<HTMLElement>(".website-container");

		if (!container) {
			return;
		}

		const synchronize = () => synchronizeWebsiteEditorHeaderBlockSize(element);
		const ResizeObserverConstructor = globalThis.ResizeObserver;
		const resizeObserver = ResizeObserverConstructor ? new ResizeObserverConstructor(() => synchronize()) : null;

		synchronize();
		resizeObserver?.observe(container);
		container
			.querySelectorAll<HTMLElement>("[data-area='header'] > div > .iw-layout")
			.forEach((header) => resizeObserver?.observe(header));
		window.addEventListener("resize", synchronize);

		return () => {
			resizeObserver?.disconnect();
			window.removeEventListener("resize", synchronize);
			container.style.removeProperty(websiteEditorHeaderBlockSize);
		};
	}, [target.area, target.index]);

	useLayoutEffect(() => {
		const element = root.current;

		if (!element || target.area !== "header") {
			return;
		}

		const synchronize = () => synchronizeWebsiteEditorHeaderDesignPosition(element);
		const ResizeObserverConstructor = globalThis.ResizeObserver;
		const resizeObserver = ResizeObserverConstructor ? new ResizeObserverConstructor(() => synchronize()) : null;

		synchronize();
		resizeObserver?.observe(element);
		element
			.querySelectorAll<HTMLElement>(
				"[data-website-layout-occupied='actions'], [data-website-layout-occupied='brand'], [data-website-layout-occupied='navigation']"
			)
			.forEach((region) => resizeObserver?.observe(region));
		window.addEventListener("resize", synchronize);

		return () => {
			resizeObserver?.disconnect();
			window.removeEventListener("resize", synchronize);
			element.style.removeProperty(websiteEditorHeaderDesignPosition);
		};
	}, [target.area]);

	return (
		<div
			className={cn(
				"relative data-[editable=true]:after:pointer-events-none data-[editable=true]:after:absolute data-[editable=true]:after:inset-0 data-[editable=true]:after:z-10 data-[editable=true]:after:border-2 data-[editable=true]:after:border-[var(--color-selection)] data-[editable=true]:after:opacity-0 data-[editable=true]:after:transition-opacity data-[editable=true]:after:duration-200 data-[editable=true]:after:ease-out data-[editable=true]:after:content-['']",
				(target.area === "page" || target.area === "footer") &&
					"data-[editable=true]:focus-within:after:opacity-100 hover:data-[editable=true]:after:opacity-100",
				"motion-reduce:data-[editable=true]:after:transition-none",
				"[--website-loading-fill:color-mix(in_srgb,var(--accent-primary)_18%,var(--surface-subtle))]",
				"[&_.iw-media-frame[data-website-media-ready=false]]:after:pointer-events-none [&_.iw-media-frame[data-website-media-ready=false]]:after:absolute [&_.iw-media-frame[data-website-media-ready=false]]:after:inset-0 [&_.iw-media-frame[data-website-media-ready=false]]:after:shimmer [&_.iw-media-frame[data-website-media-ready=false]]:after:shimmer-bg [&_.iw-media-frame[data-website-media-ready=false]]:after:bg-[var(--website-loading-fill)] [&_.iw-media-frame[data-website-media-ready=false]]:after:content-['']",
				"motion-reduce:[&_.iw-media-frame[data-website-media-ready=false]]:after:animate-none",
				"[&_[data-website-inline-text]]:relative [&_[data-website-inline-text]]:min-w-[min(10ch,100%)] [&_[data-website-inline-text]]:cursor-text [&_[data-website-inline-text]]:outline-2 [&_[data-website-inline-text]]:outline-transparent [&_[data-website-inline-text]]:outline-offset-0 [&_[data-website-inline-text]]:transition-[outline-color,background-color] [&_[data-website-inline-text]]:duration-[120ms] [&_[data-website-inline-text]]:ease-out",
				"[&_[data-website-inline-text]:empty]:before:text-current [&_[data-website-inline-text]:empty]:before:opacity-[0.48] [&_[data-website-inline-text]:empty]:before:content-[attr(data-placeholder)]",
				"[&_[data-website-inline-text]:focus]:bg-[color-mix(in_srgb,var(--color-selection)_8%,transparent)] [&_[data-website-inline-text]:focus]:outline-[var(--color-selection)] [&_[data-website-inline-text]:hover]:outline-[color-mix(in_srgb,var(--color-selection)_72%,transparent)]",
				"[&_[data-website-inline-text]::selection]:bg-[color-mix(in_srgb,var(--color-selection)_28%,transparent)] [&_[data-website-inline-text]::selection]:text-current motion-reduce:[&_[data-website-inline-text]]:transition-none",
				"[&_[data-website-inline-link]]:outline-1 [&_[data-website-inline-link]]:outline-transparent [&_[data-website-inline-link]]:outline-offset-1 [&_[data-website-inline-link]]:transition-[outline-color] [&_[data-website-inline-link]]:duration-[120ms] [&_[data-website-inline-link]]:ease-out",
				"[&_[data-website-inline-link]:hover]:outline-[color-mix(in_srgb,var(--color-selection)_52%,transparent)] motion-reduce:[&_[data-website-inline-link]]:transition-none",
				"group/website-section group/button-reveal"
			)}
			data-area={target.area}
			data-editable
			data-failed={readiness?.failed ?? false}
			data-layout-controls-visible={target.area === "header" ? true : undefined}
			data-website-section-id={section.id}
			onPointerUpCapture={controls ? focusWebsitePreviewSection : undefined}
			ref={root}
			tabIndex={controls ? -1 : undefined}
		>
			{controls && target.area === "page" && (
				<>
					{target.index > 0 && (
						<WebsiteSectionInsertionControl
							controls={controls}
							edge='top'
							editorLocked={editorLocked}
							target={{ index: target.index, pageId: target.pageId }}
						/>
					)}
					<WebsitePageSectionControls
						controls={controls}
						editorLocked={editorLocked}
						hasBehavior={hasLogic}
						sectionId={section.id}
						target={target}
					/>
				</>
			)}
			{controls &&
				target.area === "footer" &&
				target.index === 0 &&
				activePageId !== undefined &&
				activePageSectionCount !== undefined && (
					<WebsiteSectionInsertionControl
						controls={controls}
						edge='top'
						editorLocked={editorLocked}
						target={{ index: activePageSectionCount, pageId: activePageId }}
					/>
				)}
			<div
				className={cn(
					target.area !== "header" && "[contain-intrinsic-block-size:auto_44rem] [content-visibility:auto]",
					target.area === "header" &&
						"[&>.iw-layout]:outline-2 [&>.iw-layout]:outline-transparent [&>.iw-layout]:outline-offset-[-2px] [&>.iw-layout]:transition-[outline-color] [&>.iw-layout]:duration-200 [&>.iw-layout]:ease-out group-focus-within/website-section:[&>.iw-layout]:outline-[var(--color-selection)] group-hover/website-section:[&>.iw-layout]:outline-[var(--color-selection)] motion-reduce:[&>.iw-layout]:transition-none"
				)}
			>
				{children}
			</div>
			{controls && target.area === "page" && (
				<WebsiteSectionInsertionControl
					controls={controls}
					edge='bottom'
					editorLocked={editorLocked}
					target={{ index: target.index + 1, pageId: target.pageId }}
				/>
			)}
			{target.area === "header" && controls?.headerMenu && (
				<WebsiteHeaderMenu
					context={controls.headerMenu}
					disabled={editorLocked || controls.disabled}
					edit={controls.edit}
					pending={controls.pending}
					root={root}
					section={section}
				/>
			)}
			{controls && target.area !== "page" && (
				<WebsiteLayoutSectionControls
					controls={controls}
					editorLocked={editorLocked}
					sectionId={section.id}
					target={target}
				/>
			)}
		</div>
	);
};
