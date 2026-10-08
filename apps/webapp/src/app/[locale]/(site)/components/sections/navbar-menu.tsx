"use client";

import { useState, type ComponentProps, type ReactNode } from "react";

import { Menu01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { Logo } from "@/components/logo";
import { Link } from "@/i18n/navigation";
import { Button } from "@starter/ui/components/button";
import {
	Drawer,
	DrawerClose,
	DrawerDescription,
	DrawerHeader,
	DrawerPopup as DrawerContent,
	DrawerTitle,
	DrawerTrigger,
} from "@starter/ui/components/drawer";
import { cn } from "@starter/ui/lib/utils";

const NavbarLink = ({ children, className, href, ...props }: ComponentProps<typeof Link>) => {
	return (
		<Link
			className={cn(
				"rounded-sm text-sm font-medium text-olive-700 transition-colors hover:text-olive-950 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-olive-700",
				className
			)}
			href={href}
			{...props}
		>
			{children}
		</Link>
	);
};

const navLinks = [
	{ href: "/#features", key: "features" },
	{ href: "/#faqs", key: "faqs" },
] as const;

type NavbarMenuProps = ComponentProps<"header"> & {
	desktopContinueButton: ReactNode;
	mobileContinueButton: ReactNode;
};

export const NavbarMenu = ({ className, desktopContinueButton, mobileContinueButton, ...props }: NavbarMenuProps) => {
	const t = useTranslations("site.navbar");
	const brand = useTranslations("site");
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	return (
		<Drawer onOpenChange={setMobileMenuOpen} open={mobileMenuOpen} position='end'>
			<header className={cn("sticky top-0 z-30 bg-olive-50/85 backdrop-blur-xl", className)} {...props}>
				<nav
					aria-label={t("navigation")}
					className='mx-auto flex h-18 max-w-7xl items-center justify-between px-6 lg:px-10'
				>
					<Link
						aria-label={t("home")}
						className='flex items-center gap-2 rounded-sm focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-olive-700'
						data-testid='home-link'
						href='/'
					>
						<Logo className='size-7 text-olive-950' />
						<span className='text-2xl font-semibold tracking-[-0.05em] text-olive-950'>
							{brand("brand")}
						</span>
					</Link>

					<div className='flex items-center gap-8'>
						<div className='hidden items-center gap-6 lg:flex'>
							{navLinks.map((link) => (
								<NavbarLink href={link.href} key={link.href}>
									{t(link.key)}
								</NavbarLink>
							))}
						</div>
						<div className='hidden items-center lg:flex'>{desktopContinueButton}</div>

						<DrawerTrigger
							render={
								<Button
									aria-label={t("openMenu")}
									className='lg:hidden'
									size='icon-xl'
									type='button'
									variant='ghost'
								/>
							}
						>
							<HugeiconsIcon
								aria-hidden='true'
								className='scale-110'
								icon={Menu01Icon}
								strokeWidth={1.75}
							/>
						</DrawerTrigger>
					</div>
				</nav>
			</header>

			<DrawerContent className='max-w-sm lg:hidden' variant='straight'>
				<DrawerHeader className='flex-row items-center justify-between'>
					<DrawerTitle className='sr-only'>{t("mobileNavigation")}</DrawerTitle>
					<DrawerDescription className='sr-only'>{t("mobileNavigationDescription")}</DrawerDescription>
					<Link
						aria-label={t("home")}
						className='flex items-center gap-2 rounded-sm focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-olive-700'
						href='/'
						onClick={() => setMobileMenuOpen(false)}
					>
						<Logo className='size-7 text-olive-950' />
						<span className='text-2xl font-semibold tracking-[-0.05em] text-olive-950'>
							{brand("brand")}
						</span>
					</Link>
					<DrawerClose
						render={<Button aria-label={t("closeMenu")} size='icon-xl' type='button' variant='ghost' />}
					>
						<HugeiconsIcon
							aria-hidden='true'
							className='scale-110'
							icon={Cancel01Icon}
							strokeWidth={1.75}
						/>
					</DrawerClose>
				</DrawerHeader>
				<nav aria-label={t("mobileNavigation")} className='flex flex-1 flex-col px-6 py-8'>
					<div className='flex flex-col gap-7'>
						{navLinks.map((link) => (
							<NavbarLink
								className='text-3xl font-medium'
								href={link.href}
								key={link.href}
								onClick={() => setMobileMenuOpen(false)}
							>
								{t(link.key)}
							</NavbarLink>
						))}
					</div>
					<div className='mt-10'>{mobileContinueButton}</div>
				</nav>
			</DrawerContent>
		</Drawer>
	);
};
