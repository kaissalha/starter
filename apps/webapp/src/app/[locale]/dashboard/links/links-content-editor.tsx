"use client";

import { useState } from "react";

import {
	Calendar03Icon,
	Clock01Icon,
	Heading01Icon,
	HelpCircleIcon,
	Layout01Icon,
	Mail01Icon,
	Megaphone01Icon,
	PlayCircle02Icon,
	QuoteDownIcon,
	TextWrapIcon,
	GridViewIcon,
	Link01Icon,
	Location01Icon,
	MenuRestaurantIcon,
	Share08Icon,
	StarIcon,
	TextIcon,
	Video01Icon,
	WhatsappIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { apiClient } from "@/lib/api-client";
import {
	httpUrlSchema,
	LinkPageSocialIcon,
	linkPageBlockKinds,
	linkPageLimits,
	linkPageSocialPlatformLabels,
	linkPageSocialPlatforms,
	type LinkPageBlockKind,
	type LinkPageSocialsBlock,
} from "@starter/infinite-links";
import { Button } from "@starter/ui/components/button";
import { Field, FieldControl, FieldError } from "@starter/ui/components/field";

import { LinksBlockPanel } from "./links-block-settings";
import { linkPagePresets, type LinkPagePreset } from "./links-document-operations";
import { LinksChoiceList, LinksFieldset, LinksPanel } from "./links-panel";
import type { LinksPageController } from "./use-links-page-controller";

const blockKindIcons = {
	announcement: Megaphone01Icon,
	collection: GridViewIcon,
	countdown: Clock01Icon,
	embed: PlayCircle02Icon,
	faq: HelpCircleIcon,
	form: Mail01Icon,
	header: Heading01Icon,
	link: Link01Icon,
	marquee: TextWrapIcon,
	socials: Share08Icon,
	tabs: Layout01Icon,
	testimonials: QuoteDownIcon,
	text: TextIcon,
	video: Video01Icon,
} satisfies Record<LinkPageBlockKind, IconSvgElement>;

const presetIcons = {
	booking: Calendar03Icon,
	directions: Location01Icon,
	menu: MenuRestaurantIcon,
	reviews: StarIcon,
	whatsapp: WhatsappIcon,
} satisfies Record<LinkPagePreset, IconSvgElement>;

const AddSocialPanel = ({ block, controller }: { block: LinkPageSocialsBlock; controller: LinksPageController }) => {
	const t = useTranslations("links.editor");
	const used = new Set(block.items.map((social) => social.platform));

	return (
		<LinksPanel onBack={() => controller.setView({ id: block.id, kind: "block" })} title={t("addSocial")}>
			<LinksChoiceList
				onSelect={(platform) => controller.addSocial({ blockId: block.id, platform })}
				options={linkPageSocialPlatforms
					.filter((platform) => !used.has(platform))
					.map((platform) => ({
						icon: <LinkPageSocialIcon platform={platform} />,
						label: linkPageSocialPlatformLabels[platform],
						value: platform,
					}))}
			/>
		</LinksPanel>
	);
};

const withProtocol = (value: string) => (/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);

const LinksPasteLinkField = ({
	controller,
	index,
	placement,
}: {
	controller: LinksPageController;
	index: number;
	placement: "header" | "page";
}) => {
	const t = useTranslations("links.editor");
	const queryClient = useQueryClient();
	const [value, setValue] = useState("");
	const [invalid, setInvalid] = useState(false);

	const add = useMutation({
		mutationFn: async (url: string) => {
			const hostname = new URL(url).hostname.replace(/^www\./, "");

			try {
				const preview = await queryClient.query(
					apiClient.linkPreviews.get.queryOptions({ input: { url }, retry: false })
				);

				controller.addUrlLink({
					index,
					label: preview?.title || preview?.siteName || hostname,
					placement,
					url,
				});
			} catch {
				controller.addUrlLink({ index, label: hostname, placement, url });
			}
		},
	});

	return (
		<form
			className='flex items-start gap-2'
			onSubmit={(event) => {
				event.preventDefault();
				const parsed = httpUrlSchema.safeParse(withProtocol(value.trim()));
				setInvalid(!parsed.success);

				if (parsed.success) {
					add.mutate(parsed.data);
				}
			}}
		>
			<Field className='min-w-0 flex-1' invalid={invalid}>
				<FieldControl
					aria-label={t("pasteLink")}
					disabled={add.isPending}
					inputMode='url'
					maxLength={2048}
					onChange={(event) => {
						setValue(event.currentTarget.value);
						setInvalid(false);
					}}
					placeholder={t("pasteLink")}
					value={value}
				/>
				<FieldError match role='alert'>
					{t("invalidUrl")}
				</FieldError>
			</Field>
			<Button disabled={!value.trim()} loading={add.isPending} type='submit'>
				{t("pasteLinkAction")}
			</Button>
		</form>
	);
};

const AddBlockPanel = ({ controller }: { controller: LinksPageController }) => {
	const t = useTranslations("links.editor");
	const index = controller.view.kind === "add-block" ? controller.view.index : controller.document.blocks.length;
	const placement = controller.view.kind === "add-block" ? controller.view.placement : "page";
	const hasSocials = controller.document.blocks.some((block) => block.kind === "socials");
	const contentBlockCount = controller.document.blocks.filter((block) => block.kind !== "socials").length;

	return (
		<LinksPanel onBack={() => controller.setView({ kind: "root" })} title={t("addBlock")}>
			{contentBlockCount < linkPageLimits.blocks && (
				<LinksPasteLinkField controller={controller} index={index} placement={placement} />
			)}
			<LinksFieldset description={t("addBlockDescription")}>
				<LinksChoiceList
					onSelect={(kind) => controller.addBlock({ index, kind, placement })}
					options={linkPageBlockKinds
						.filter(
							(kind) =>
								(kind === "socials" && !hasSocials) ||
								(kind !== "socials" && contentBlockCount < linkPageLimits.blocks)
						)
						.map((kind) => {
							const Icon = blockKindIcons[kind];

							return {
								description: t(`kinds.${kind}Description`),
								icon: (
									<HugeiconsIcon
										aria-hidden='true'
										className='scale-110'
										icon={Icon}
										strokeWidth={1.75}
									/>
								),
								label: t(`kinds.${kind}`),
								value: kind,
							};
						})}
				/>
			</LinksFieldset>
			{contentBlockCount < linkPageLimits.blocks && (
				<LinksFieldset description={t("quickLinksDescription")} legend={t("quickLinks")}>
					<LinksChoiceList
						onSelect={(preset) => controller.addPresetLink({ index, placement, preset })}
						options={linkPagePresets.map((preset) => ({
							icon: (
								<HugeiconsIcon
									aria-hidden='true'
									className='scale-110'
									icon={presetIcons[preset]}
									strokeWidth={1.75}
								/>
							),
							label: t(`presets.${preset}`),
							value: preset,
						}))}
					/>
				</LinksFieldset>
			)}
		</LinksPanel>
	);
};

export const LinksContentEditor = ({ controller }: { controller: LinksPageController }) => {
	const { view } = controller;

	if (view.kind === "block") {
		const block = controller.document.blocks.find((candidate) => candidate.id === view.id);

		return block ? <LinksBlockPanel block={block} controller={controller} /> : null;
	}

	if (view.kind === "add-social") {
		const block = controller.document.blocks.find(
			(candidate): candidate is LinkPageSocialsBlock => candidate.id === view.id && candidate.kind === "socials"
		);

		return block ? <AddSocialPanel block={block} controller={controller} /> : null;
	}

	return <AddBlockPanel controller={controller} />;
};
