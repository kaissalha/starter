import { Suspense, type ReactNode } from "react";

import type { Metadata } from "next";
import { cookies } from "next/headers";

import { ThemeProvider } from "@wrksz/themes/next";
import { getTranslations } from "next-intl/server";

import { AuthSessionContext } from "@/components/auth/auth-session-context";
import { PostHogIdentify } from "@/lib/posthog";
import { requireDashboardSession } from "@/lib/server/dashboard-session";
import { HydrateClient } from "@/lib/server/react-query";
import { getTimezone } from "@/utils/get-timezone";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarInset,
	SidebarProvider,
} from "@starter/ui/components/sidebar";
import { getDirection } from "@starter/utils";

import { DashboardThemeScope, DashboardTimeZoneProvider } from "./components/layout/dashboard-time-zone-provider";
import { AppSidebar } from "./components/layout/sidebar/app-sidebar";
import { SettingsModal } from "./components/settings/settings-modal";

const AppSidebarFallback = () => (
	<Sidebar border='editor' collapsible='icon' purpose='navigation'>
		<SidebarHeader>
			<div className='flex size-8 items-center justify-center'>
				<div className='size-7 animate-pulse rounded-lg bg-sidebar-accent' />
			</div>
		</SidebarHeader>
		<SidebarContent>
			<div className='flex flex-col gap-1 py-2'>
				{["home", "chat"].map((item) => (
					<div className='flex h-8 items-center gap-2 rounded-xl px-2' key={item}>
						<div className='size-4 shrink-0 animate-pulse rounded bg-sidebar-accent' />
						<div className='h-3 w-24 animate-pulse rounded bg-sidebar-accent group-data-[collapsible=icon]:hidden' />
					</div>
				))}
			</div>
		</SidebarContent>
		<SidebarFooter>
			<div className='flex flex-col gap-1'>
				{["settings", "logout"].map((item) => (
					<div className='flex h-8 items-center gap-2 rounded-xl px-2' key={item}>
						<div className='size-4 shrink-0 animate-pulse rounded bg-sidebar-accent' />
						<div className='h-3 w-24 animate-pulse rounded bg-sidebar-accent group-data-[collapsible=icon]:hidden' />
					</div>
				))}
			</div>
		</SidebarFooter>
	</Sidebar>
);

const DashboardShellFallback = () => (
	<div className='flex flex-1'>
		<div className='hidden w-12 shrink-0 border-e border-sidebar-border bg-sidebar md:block' />
		<div className='min-w-0 flex-1' />
	</div>
);

const getViewerTimeZone = async () => {
	try {
		return new Intl.DateTimeFormat("en", { timeZone: await getTimezone() }).resolvedOptions().timeZone;
	} catch {
		return "UTC";
	}
};

const DashboardSidebarShell = async ({ children, dir }: { children: ReactNode; dir: "ltr" | "rtl" }) => {
	const [cookieStore, initialSession, t, timeZone] = await Promise.all([
		cookies(),
		requireDashboardSession(),
		getTranslations("common"),
		getViewerTimeZone(),
	]);

	const sidebarOpen = cookieStore.get("sidebar_state_navigation")?.value === "true";

	return (
		<DashboardTimeZoneProvider timeZone={timeZone}>
			<AuthSessionContext initialSession={initialSession}>
				<PostHogIdentify />
				<SidebarProvider className='flex flex-1' defaultOpen={sidebarOpen} dir={dir} purpose='navigation'>
					<Suspense fallback={<AppSidebarFallback />}>
						<AppSidebar border='editor' />
					</Suspense>
					<SidebarInset className='overflow-auto overscroll-none'>
						<div className='flex h-[calc(100dvh-var(--sidebar-inset-top,0px))] max-h-[calc(100dvh-var(--sidebar-inset-top,0px))] min-h-0 flex-col overflow-hidden'>
							{children}
						</div>
					</SidebarInset>
				</SidebarProvider>
				<Suspense
					fallback={
						<span className='sr-only' role='status'>
							{t("loading")}
						</span>
					}
				>
					<SettingsModal />
				</Suspense>
			</AuthSessionContext>
		</DashboardTimeZoneProvider>
	);
};

export const metadata: Metadata = { robots: { follow: false, index: false } };

export default async function DashboardLayout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;

	return (
		<ThemeProvider defaultTheme='system' disableTransitionOnChange>
			<DashboardThemeScope />
			<HydrateClient>
				<Suspense fallback={<DashboardShellFallback />}>
					<DashboardSidebarShell dir={getDirection(locale)}>{children}</DashboardSidebarShell>
				</Suspense>
			</HydrateClient>
		</ThemeProvider>
	);
}
