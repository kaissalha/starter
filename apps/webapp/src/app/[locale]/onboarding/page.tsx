import { Suspense } from "react";

import type { Metadata } from "next";
import { headers } from "next/headers";

import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { getTranslations } from "@/lib/i18n";
import { PostHogIdentify } from "@/lib/posthog";
import { serverClient } from "@/lib/server/api-client";
import { getServerSession } from "@/lib/server/auth";
import { auth } from "@starter/server/auth";
import { hasOrganizationPermission } from "@starter/server/permissions";

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

	const [organization, website] = session.session.activeOrganizationId
		? await Promise.all([auth.api.getFullOrganization({ headers: requestHeaders }), serverClient.websites.get()])
		: [null, null];

	if (
		organization &&
		!hasOrganizationPermission({
			permission: "write",
			role: organization.members.find((member) => member.userId === session.user.id)?.role,
		})
	) {
		redirect({ href: redirectPath, locale });
	}

	if (website?.snapshot || (website?.workflow && website.workflow.state !== "failed")) {
		redirect({ href: "/dashboard/website", locale });
	}

	return (
		<>
			<PostHogIdentify />
			<OnboardingClient
				initialBusiness={
					website?.brief ?? (organization ? { location: "", name: organization.name, type: "" } : undefined)
				}
				initialInvitations={organization ? [] : initialInvitations}
				initialOrganization={organization ? { id: organization.id, name: organization.name } : undefined}
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
