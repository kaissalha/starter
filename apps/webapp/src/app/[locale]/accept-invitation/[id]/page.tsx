import { Suspense } from "react";

import type { Metadata } from "next";
import { headers } from "next/headers";

import { isAPIError } from "better-auth/api";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { PostHogIdentify } from "@/lib/posthog";
import { getServerSession } from "@/lib/server/auth";
import { auth } from "@starter/server/auth";

import { AcceptInvitationClient } from "./accept-invitation-client";
import { AcceptInvitationSkeleton } from "./accept-invitation-skeleton";

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

export default function AcceptInvitationPage(props: AcceptInvitationPageProps) {
	return (
		<Suspense fallback={<AcceptInvitationSkeleton />}>
			<AcceptInvitationContent {...props} />
		</Suspense>
	);
}
