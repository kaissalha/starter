"use client";

import { useEffect, useRef } from "react";

import { AiMagicIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Loader } from "@starter/ui/components/loader";
import { Popover, PopoverPopup } from "@starter/ui/components/popover";

import type { useWebsiteTextEditor } from "./use-website-text-editor";

export const WebsiteTextAIEditor = ({
	state,
}: {
	state: ReturnType<typeof useWebsiteTextEditor> & {
		active: NonNullable<ReturnType<typeof useWebsiteTextEditor>["active"]>;
	};
}) => {
	const t = useTranslations("website.inlineEdit.ai");
	const input = useRef<HTMLInputElement>(null);
	const { active, cancel, close, expand, generate, keepOpen, leave } = state;
	useEffect(() => cancel, [cancel]);
	useEffect(() => {
		if (active.expanded) {
			input.current?.focus({ preventScroll: true });
		}
	}, [active.expanded]);
	const { anchor, expanded, generating } = active;

	return (
		<Popover
			modal={false}
			onOpenChange={(open, details) => {
				if (!open && !(details.reason === "outside-press" && details.event.composedPath().includes(anchor))) {
					close();
				}
			}}
			open
		>
			<PopoverPopup
				align='end'
				anchor={anchor}
				aria-label={t("title")}
				className='min-w-0 max-w-full'
				finalFocus={false}
				initialFocus={false}
				onBlur={leave}
				onFocus={keepOpen}
				padding='xs'
				positionerProps={{
					className:
						"z-[70] max-w-[calc(100vw-1rem)] after:absolute after:end-0 after:h-1.5 after:w-[max(100%,var(--anchor-width))] data-[side=bottom]:after:bottom-full data-[side=top]:after:top-full",
					onPointerEnter: keepOpen,
					onPointerLeave: leave,
				}}
				side='top'
				sideOffset={6}
			>
				{expanded ? (
					<form
						aria-busy={generating}
						className='flex w-[min(28rem,calc(100vw-2rem))] items-center gap-1'
						onSubmit={(event) => {
							event.preventDefault();
							generate(input.current?.value ?? "");
						}}
					>
						<Input
							aria-label={t("instruction")}
							className='min-w-0 flex-1'
							corners='pill'
							disabled={generating}
							maxLength={1000}
							placeholder={t("placeholder")}
							ref={input}
							unstyled
						/>
						<Button disabled={generating} size='lg' type='submit'>
							{generating && <Loader aria-hidden='true' />}
							{t(generating ? "generating" : "generate")}
						</Button>
						<Button
							aria-label={t("close")}
							className='shrink-0'
							onClick={close}
							size='icon'
							type='button'
							variant='ghost'
						>
							<HugeiconsIcon
								aria-hidden='true'
								className='scale-110'
								icon={Cancel01Icon}
								strokeWidth={1.75}
							/>
						</Button>
						{generating && (
							<span className='sr-only' role='status'>
								{t("generating")}
							</span>
						)}
					</form>
				) : (
					<Button onClick={expand} size='lg' type='button' variant='ghost'>
						<HugeiconsIcon aria-hidden='true' className='scale-110' icon={AiMagicIcon} strokeWidth={1.75} />
						{t("title")}
					</Button>
				)}
			</PopoverPopup>
		</Popover>
	);
};
