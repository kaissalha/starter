import { Suspense } from "react";

import type { Metadata } from "next";
import { headers } from "next/headers";

import { isAPIError } from "better-auth/api";
import { useTranslations } from "next-intl";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { PostHogIdentify } from "@/lib/posthog";
import { getServerSession } from "@/lib/server/auth";
import { auth } from "@starter/server/auth";
import { Skeleton } from "@starter/ui/components/skeleton";

import { AcceptInvitationClient } from "./accept-invitation-client";

export const metadata: Metadata = { robots: { follow: false, index: false } };

type AcceptInvitationPageProps = {
	params: Promise<{ id: string }>;
};

const getInvitationState = async ({ headersList, id }: { headersList: Headers; id: string }) => {
	try {
		const invitation = await auth.api.getInvitation({ headers: headersList, query: { id } });

		return {
			invitation: {
				email: invitation.email,
				organizationName: invitation.organizationName,
				role: invitation.role,
			},
			status: "pending" as const,
		};
	} catch (error) {
		if (isAPIError(error) && error.statusCode === 403) {
			return { status: "mismatch" as const };
		}

		if (isAPIError(error) && error.statusCode === 400) {
			return { status: "unavailable" as const };
		}

		return { status: "error" as const };
	}
};

const AcceptInvitationContent = async ({ params }: AcceptInvitationPageProps) => {
	const [{ id }, headersList, locale, session] = await Promise.all([
		params,
		headers(),
		getLocale(),
		getServerSession(),
	]);

	if (!session) {
		const redirectTarget = `/${locale}/accept-invitation/${id}`;
		redirect({ href: `/login?redirect_url=${encodeURIComponent(redirectTarget)}`, locale });

		return null;
	}

	const invitationState = await getInvitationState({ headersList, id });

	return (
		<>
			<PostHogIdentify />
			<AcceptInvitationClient {...invitationState} invitationId={id} key={id} userEmail={session.user.email} />
		</>
	);
};

const AcceptInvitationFallback = () => {
	const t = useTranslations("common");

	return (
		<div className='flex min-h-dvh items-center justify-center p-6' role='status'>
			<span className='sr-only'>{t("loading")}</span>
			<div aria-hidden className='flex w-full max-w-md flex-col items-center gap-4'>
				<Skeleton className='size-12' corners='circle' />
				<Skeleton className='h-7 w-56 max-w-full' />
				<Skeleton className='h-4 w-80 max-w-full' />
				<Skeleton className='mt-3 h-10 w-full' />
			</div>
		</div>
	);
};

export default function AcceptInvitationPage(props: AcceptInvitationPageProps) {
	return (
		<Suspense fallback={<AcceptInvitationFallback />}>
			<AcceptInvitationContent {...props} />
		</Suspense>
	);
}
