import { Suspense } from "react";

import type { Metadata } from "next";
import { headers } from "next/headers";

import { getLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { PostHogIdentify } from "@/lib/posthog";
import { getServerSession } from "@/lib/server/auth";
import { auth } from "@starter/server/auth";

import { OnboardingClient } from "./components/onboarding-client";
import { getOnboardingRedirectPath } from "./components/onboarding-utils";

type OnboardingPageProps = {
	searchParams: Promise<{ redirect_url?: string | Array<string> | undefined }>;
};

export const generateMetadata = async (): Promise<Metadata> => {
	const t = await getTranslations("onboarding");

	return {
		description: t("description"),
		robots: { follow: false, index: false },
		title: t("title"),
	};
};

const OnboardingPageContent = async ({ searchParams }: OnboardingPageProps) => {
	const requestHeaders = await headers();

	const [{ redirect_url: redirectUrl }, locale, session, initialInvitations] = await Promise.all([
		searchParams,
		getLocale(),
		getServerSession(),
		(async () => {
			try {
				return await auth.api.listUserInvitations({ headers: requestHeaders });
			} catch {
				return null;
			}
		})(),
	]);

	if (!session) {
		redirect({ href: "/login", locale });

		return null;
	}

	const redirectPath = getOnboardingRedirectPath({ redirectUrl });

	if (session.session.activeOrganizationId) {
		redirect({ href: redirectPath, locale });
	}

	return (
		<>
			<PostHogIdentify />
			<OnboardingClient
				initialInvitations={initialInvitations}
				redirectPath={redirectPath}
				userEmail={session.user.email}
			/>
		</>
	);
};

export default function OnboardingPage({ searchParams }: OnboardingPageProps) {
	return (
		<Suspense fallback={<div className='min-h-dvh bg-background' />}>
			<OnboardingPageContent searchParams={searchParams} />
		</Suspense>
	);
}
