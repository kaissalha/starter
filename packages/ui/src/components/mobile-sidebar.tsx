"use client";

import * as React from "react";

import { cva } from "class-variance-authority";

import { cn } from "../lib/utils";
import { Button } from "./button";
import { Drawer, DrawerPopup, DrawerTitle } from "./drawer";
import { type CSSPropertiesWithVariables, type SidebarPurpose, useSidebar } from "./sidebar";

const mobileSidebarVariants = cva("bg-sidebar p-0 text-sidebar-foreground *:data-[slot=drawer-close]:hidden", {
	variants: { purpose: { chat: "w-full", details: "w-full", navigation: null } },
});

const SIDEBAR_WIDTH_MOBILE = "18rem";

type MobileSidebarSnapPoint = number | string;

const selectsOption = (target: EventTarget) => {
	if (!(target instanceof Element)) {
		return false;
	}

	const option = target.closest("[role=radio]") ?? target.closest("label")?.querySelector("[role=radio]") ?? null;

	return option !== null && !option.matches("[aria-disabled=true], [data-disabled]");
};

export type MobileSidebarPeek = { height: string; label: string; resetKey: string };

export const MobileSidebar = ({
	"aria-label": ariaLabel = "Sidebar",
	children,
	className,
	modal = true,
	onClick,
	onOpenChange,
	peek,
	position,
	purpose,
	ref,
	style,
	...props
}: React.ComponentProps<"div"> & {
	children: React.ReactNode;
	modal?: boolean;
	onOpenChange?: (open: boolean) => void;
	peek?: MobileSidebarPeek;
	position: "bottom" | "left" | "right";
	purpose: SidebarPurpose;
}) => {
	const { openMobile, setOpenMobile } = useSidebar(purpose);
	const [snap, setSnap] = React.useState<{ key?: string; point: MobileSidebarSnapPoint }>({ point: 1 });
	const snapPoint = snap.key === peek?.resetKey ? snap.point : 1;
	const peeked = peek !== undefined && snapPoint === peek.height;
	const snapTo = (point: MobileSidebarSnapPoint) => setSnap({ key: peek?.resetKey, point });

	if (!openMobile && snap.point !== 1) {
		setSnap({ point: 1 });
	}

	const sidebarWidthVar = `--sidebar-width-${purpose}`;

	const popupStyle: CSSPropertiesWithVariables = {
		...style,
		[sidebarWidthVar]: SIDEBAR_WIDTH_MOBILE,
		width: purpose === "navigation" ? `var(${sidebarWidthVar})` : undefined,
	};

	return (
		<Drawer
			disablePointerDismissal={!modal}
			modal={modal}
			onOpenChange={(open, details) => {
				if (!open && peek && details.reason === "swipe") {
					snapTo(peek.height);

					return;
				}

				setOpenMobile(open);
				onOpenChange?.(open);
			}}
			onSnapPointChange={(point) => snapTo(point ?? 1)}
			open={openMobile}
			position={position}
			snapPoint={peek ? snapPoint : undefined}
			snapPoints={peek ? [peek.height, 1] : undefined}
		>
			<DrawerPopup
				className={cn(mobileSidebarVariants({ purpose }), className)}
				data-mobile='true'
				data-peeked={peeked || undefined}
				data-sidebar='sidebar'
				onClick={(event) => {
					onClick?.(event);

					if (peek && selectsOption(event.target)) {
						snapTo(peek.height);
					} else if (peeked) {
						snapTo(1);
					}
				}}
				ref={ref}
				showBar={position === "bottom" && !peek}
				style={popupStyle}
				variant={position === "bottom" ? "default" : "inset"}
				{...props}
			>
				{peek && (
					<Button
						aria-expanded={!peeked}
						aria-label={peek.label}
						className='flex w-full shrink-0 cursor-pointer justify-center pt-3 pb-1 outline-none focus-visible:*:bg-ring'
						onClick={() => {
							if (!peeked) {
								snapTo(peek.height);
							}
						}}
						type='button'
						unstyled
					>
						<span className='h-1 w-12 rounded-full bg-border' />
					</Button>
				)}
				<DrawerTitle className='sr-only'>{ariaLabel}</DrawerTitle>
				<div className='flex min-h-0 w-full flex-1 flex-col'>{children}</div>
			</DrawerPopup>
		</Drawer>
	);
};
