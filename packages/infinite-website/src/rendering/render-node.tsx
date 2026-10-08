import type { ReactNode } from "react";

import { cn } from "cn";

import { BehaviorField, BehaviorTrigger, BehaviorValue, BehaviorVisibility } from "../behavior/runtime";
import type { LinkValue } from "../document/content-schema";
import type { SiteNode } from "../document/structure-schema";
import type { Iso6391LanguageCode } from "../language-codes";
import { Action } from "../primitives/action";
import { Box } from "../primitives/box";
import { Carousel } from "../primitives/carousel";
import { Disclosure } from "../primitives/disclosure";
import { Embed, type ContactFormContext } from "../primitives/embed";
import { Flex } from "../primitives/flex";
import { Grid } from "../primitives/grid";
import { Icon } from "../primitives/icon";
import { Masonry } from "../primitives/masonry";
import { Media } from "../primitives/media";
import { Menu } from "../primitives/menu";
import type { ResolvedAsset, SiteLinkComponent, SiteLinkElementProps } from "../primitives/shared";
import { Tabs } from "../primitives/tabs";
import { Text, type TextElementProps } from "../primitives/text";

export type AssetMap = Record<string, ResolvedAsset>;

export type SiteLogo = { alt: string; scale: number; src: string };

const SiteLogoImage = ({ logo, placement }: { logo: SiteLogo; placement: "footer" | "header" }) => (
	<img
		alt={logo.alt}
		className={cn(
			"block w-auto max-w-[calc(var(--iw-logo-scale)*12rem)] object-contain",
			placement === "header" ? "h-[calc(var(--iw-logo-scale)*2.25rem)]" : "h-[calc(var(--iw-logo-scale)*3rem)]"
		)}
		decoding='async'
		src={logo.src}
		style={{ "--iw-logo-scale": logo.scale }}
	/>
);

type RenderNodeProps = {
	assets: AssetMap;
	contactForm?: ContactFormContext;
	disclosureItemControls?: SiteDisclosureItemControlsResolver;
	disclosureItemTargets?: ReadonlyMap<string, SiteDisclosureItemTarget>;
	domAnchor?: string;
	domId?: string;
	homeHref?: string;
	linkComponent?: SiteLinkComponent;
	linkElementProps?: SiteLinkElementPropsResolver;
	linkTargets?: ReadonlyMap<string, SiteLinkElementMetadata>;
	locale: Iso6391LanguageCode;
	logo?: SiteLogo;
	logoTextIds?: ReadonlySet<string>;
	mediaControls?: (node: Extract<SiteNode, { type: "media" }>) => ReactNode;
	node: SiteNode;
	omitHomeMenuItem?: boolean;
	textElementProps?: SiteTextElementPropsResolver;
	textTargets?: ReadonlyMap<string, SiteTextElementMetadata>;
};

export type SiteMediaControlsResolver = (target: {
	alt: string;
	assetId: string;
	pointer: string;
	sectionId: string;
}) => ReactNode;

export type SiteTextElementTarget = {
	content: string;
	contentId: string;
	linkLabel: boolean;
	locale: Iso6391LanguageCode;
	nodeId: string;
	pointer: string;
	sectionId: string;
};

export type SiteTextElementPropsResolver = (target: SiteTextElementTarget) => TextElementProps | undefined;

export type SiteMenuDropdownItemTarget = {
	elementId: string;
	labels: Array<{
		content: string;
		nodeId: string;
		pointer: string;
	}>;
	pointer: string;
	value: LinkValue;
};

export type SiteMenuItemTarget = SiteMenuDropdownItemTarget & {
	items: Array<SiteMenuDropdownItemTarget>;
	locale: Iso6391LanguageCode;
	sectionId: string;
};

export type SiteLinkElementTarget = {
	contentId: string;
	elementId: string;
	elementType: "action" | "menu";
	href: string;
	labels: Array<{
		content: string;
		nodeId: string;
		pointer: string;
	}>;
	locale: Iso6391LanguageCode;
	menuItem?: SiteMenuItemTarget | undefined;
	menuRole?: "dropdown-item" | "dropdown-trigger" | "navigation-item" | undefined;
	pointer: string;
	sectionId: string;
	value: LinkValue;
};

export type SiteLinkElementPropsResolver = (target: SiteLinkElementTarget) => SiteLinkElementProps | undefined;

export type SiteDisclosureItemTarget = {
	collection: string;
	contentItemId: string;
	disclosureId: string;
	index: number;
	itemCount: number;
	itemId: string;
	max: number;
	min: number;
	sectionId: string;
};

export type SiteDisclosureItemControlsResolver = (target: SiteDisclosureItemTarget) => ReactNode;

type SiteTextElementMetadata = Omit<SiteTextElementTarget, "content">;

type SiteLinkElementMetadata = Omit<SiteLinkElementTarget, "href">;

type RenderNodeContext = {
	assets: AssetMap;
	contactForm?: ContactFormContext;
	disclosureItemControls?: SiteDisclosureItemControlsResolver;
	disclosureItemTargets?: ReadonlyMap<string, SiteDisclosureItemTarget>;
	homeHref: string;
	linkComponent: SiteLinkComponent;
	linkElementProps?: SiteLinkElementPropsResolver;
	linkTargets?: ReadonlyMap<string, SiteLinkElementMetadata>;
	locale: Iso6391LanguageCode;
	logo?: SiteLogo;
	logoTextIds?: ReadonlySet<string>;
	mediaControls?: (node: Extract<SiteNode, { type: "media" }>) => ReactNode;
	omitHomeMenuItem: boolean;
	textElementProps?: SiteTextElementPropsResolver;
	textTargets?: ReadonlyMap<string, SiteTextElementMetadata>;
};

const renderChildren = ({ context, nodes }: { context: RenderNodeContext; nodes: Array<SiteNode> }): ReactNode =>
	nodes.map((node) => <RenderNode key={node.id} node={node} {...context} />);

const renderCarouselHeader = ({
	context,
	header,
}: {
	context: RenderNodeContext;
	header: Extract<SiteNode, { type: "carousel" }>["props"]["header"];
}) => header && { ...header, content: renderChildren({ context, nodes: header.children }) };

const renderHoverReveal = ({
	context,
	hoverReveal,
}: {
	context: RenderNodeContext;
	hoverReveal: Extract<SiteNode, { type: "box" }>["props"]["hoverReveal"];
}) =>
	hoverReveal && {
		backdrop: renderChildren({ context, nodes: hoverReveal.backdrop }),
		coverAppearance: hoverReveal.cover,
		replacement: renderChildren({ context, nodes: hoverReveal.replacement }),
		replacementForeground: hoverReveal.replacementForeground,
	};

const renderDisclosureItems = ({
	context,
	items,
}: {
	context: RenderNodeContext;
	items: Extract<SiteNode, { type: "disclosure" }>["props"]["items"];
}) =>
	items.map((item) => {
		const target = context.disclosureItemTargets?.get(item.id);

		return {
			controls: target ? context.disclosureItemControls?.(target) : undefined,
			id: item.id,
			panel: renderChildren({ context, nodes: item.panel }),
			trigger: renderChildren({ context, nodes: item.trigger }),
		};
	});

const normalizeMenuHref = ({ href }: { href: string }) => (href.length > 1 ? href.replace(/\/+$/u, "") : href);

type LeafNode = Extract<SiteNode, { type: "embed" | "icon" | "media" | "text" }>;

const renderLeafNode = ({ context, node }: { context: RenderNodeContext; node: LeafNode }): ReactNode => {
	switch (node.type) {
		case "text": {
			if (context.logo && context.logoTextIds?.has(node.id)) {
				return <SiteLogoImage logo={context.logo} placement='footer' />;
			}

			const target = context.textTargets?.get(node.id);

			return (
				<Text
					{...node.props}
					elementProps={
						target ? context.textElementProps?.({ ...target, content: node.props.content }) : undefined
					}
					layout={node.layout}
				/>
			);
		}

		case "media":
			return (
				<Media
					{...node.props}
					asset={context.assets[node.props.assetId]}
					controls={context.mediaControls?.(node)}
					layout={node.layout}
				/>
			);
		case "icon":
			return <Icon {...node.props} layout={node.layout} />;
		case "embed":
			return <Embed {...node.props} contactForm={context.contactForm} layout={node.layout} />;
	}
};

const RenderNodeContent = ({
	assets,
	contactForm,
	disclosureItemControls,
	disclosureItemTargets,
	domAnchor,
	domId,
	homeHref = "/",
	linkComponent: LinkComponent = "a",
	linkElementProps,
	linkTargets,
	locale,
	logo,
	logoTextIds,
	mediaControls,
	node,
	omitHomeMenuItem = false,
	textElementProps,
	textTargets,
}: RenderNodeProps) => {
	const context = {
		assets,
		contactForm,
		disclosureItemControls,
		disclosureItemTargets,
		homeHref,
		linkComponent: LinkComponent,
		linkElementProps,
		linkTargets,
		locale,
		logo,
		logoTextIds,
		mediaControls,
		omitHomeMenuItem,
		textElementProps,
		textTargets,
	};

	switch (node.type) {
		case "box":
			return (
				<Box
					{...node.props}
					hoverReveal={renderHoverReveal({ context, hoverReveal: node.props.hoverReveal })}
					htmlAnchor={domAnchor}
					htmlId={domId}
					layout={node.layout}
				>
					{renderChildren({ context, nodes: node.props.children })}
				</Box>
			);
		case "flex":
			return (
				<Flex {...node.props} layout={node.layout}>
					{renderChildren({ context, nodes: node.props.children })}
				</Flex>
			);
		case "grid":
			return (
				<Grid {...node.props} layout={node.layout}>
					{renderChildren({ context, nodes: node.props.children })}
				</Grid>
			);
		case "action": {
			const target = linkTargets?.get(node.id);

			return (
				<Action
					{...node.props}
					layout={node.layout}
					linkComponent={LinkComponent}
					linkElementProps={
						target ? linkElementProps?.({ ...target, href: node.props.href.href }) : undefined
					}
				>
					{renderChildren({ context, nodes: node.props.children })}
				</Action>
			);
		}

		case "carousel":
			return (
				<Carousel
					{...node.props}
					header={renderCarouselHeader({ context, header: node.props.header })}
					layout={node.layout}
					slides={node.props.slides.map((slide) => ({
						content: <RenderNode node={slide} {...context} />,
						key: slide.id,
					}))}
				/>
			);
		case "disclosure":
			return (
				<Disclosure
					defaultOpen={node.props.defaultOpen}
					divider={node.props.divider}
					items={renderDisclosureItems({ context, items: node.props.items })}
					layout={node.layout}
					multiple={node.props.multiple}
					openIndicator={node.props.openIndicator}
					panelPadding={node.props.panelPadding}
					triggerPadding={node.props.triggerPadding}
				/>
			);
		case "menu":
			return (
				<Menu
					{...node.props}
					actions={renderChildren({ context, nodes: node.props.actions })}
					brand={
						<LinkComponent
							className='inline-flex min-w-0 items-center text-inherit no-underline'
							href={homeHref}
						>
							{logo ? (
								<SiteLogoImage logo={logo} placement='header' />
							) : (
								renderChildren({ context, nodes: node.props.brand })
							)}
						</LinkComponent>
					}
					closeLabel={locale === "ar" ? "إغلاق القائمة" : "Close menu"}
					items={node.props.items
						.filter(
							(item) =>
								!omitHomeMenuItem ||
								normalizeMenuHref({ href: item.href.href }) !== normalizeMenuHref({ href: homeHref })
						)
						.map((item) => {
							const target = linkTargets?.get(item.id);

							const elementProps = target
								? linkElementProps?.({ ...target, href: item.href.href })
								: undefined;

							return {
								id: item.id,
								link: (
									<LinkComponent href={item.href.href}>
										{renderChildren({ context, nodes: item.trigger })}
									</LinkComponent>
								),
								linkElementProps: elementProps,
								mobileLink: (
									<LinkComponent href={item.href.href}>
										{renderChildren({ context, nodes: item.mobileTrigger ?? item.trigger })}
									</LinkComponent>
								),
								mobileTrigger: item.mobileTrigger
									? renderChildren({ context, nodes: item.mobileTrigger })
									: undefined,
								panel: item.panel ? renderChildren({ context, nodes: item.panel }) : undefined,
								trigger: renderChildren({ context, nodes: item.trigger }),
							};
						})}
					layout={node.layout}
					socialActions={
						node.props.socialActions
							? renderChildren({ context, nodes: node.props.socialActions })
							: undefined
					}
				/>
			);
		case "field":
			return (
				<BehaviorField {...node.props} layout={node.layout}>
					{renderChildren({ context, nodes: node.props.children })}
				</BehaviorField>
			);
		case "value":
			return (
				<BehaviorValue {...node.props} layout={node.layout} locale={locale}>
					{renderChildren({ context, nodes: node.props.children })}
				</BehaviorValue>
			);
		case "trigger":
			return (
				<BehaviorTrigger
					disabledWhen={node.props.disabledWhen}
					event={node.props.event}
					label={node.props.label}
					layout={node.layout}
				>
					{renderChildren({ context, nodes: node.props.children })}
				</BehaviorTrigger>
			);
		case "masonry":
			return (
				<Masonry columns={node.props.columns} gap={node.props.gap} layout={node.layout}>
					{node.props.children.map((child) => (
						<RenderNode key={child.id} node={child} {...context} />
					))}
				</Masonry>
			);
		case "tabs":
			return (
				<Tabs
					{...node.props}
					items={node.props.items.map((item) => ({
						detail: item.detail ? renderChildren({ context, nodes: item.detail }) : undefined,
						disabled: item.disabled,
						id: item.id,
						panel: renderChildren({ context, nodes: item.panel }),
						trigger: renderChildren({ context, nodes: item.trigger }),
						value: item.value,
					}))}
					layout={node.layout}
					lead={node.props.lead ? renderChildren({ context, nodes: node.props.lead }) : undefined}
				/>
			);
		default:
			return renderLeafNode({ context, node });
	}
};

export const RenderNode = (props: RenderNodeProps) => (
	<BehaviorVisibility output={props.node.visibleWhen}>
		<RenderNodeContent {...props} />
	</BehaviorVisibility>
);
