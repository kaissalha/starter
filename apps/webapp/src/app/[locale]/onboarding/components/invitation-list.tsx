"use client";

import * as m from "motion/react-m";
import { useFormatter, useTranslations } from "next-intl";

import { Badge } from "@starter/ui/components/badge";
import { Button } from "@starter/ui/components/button";

import type { OnboardingInvitation } from "./use-onboarding-controller";

type InvitationListProps = {
	invitations: Array<OnboardingInvitation>;
	isAcceptingInvitation: boolean;
	onAcceptInvitation: ({ invitationId }: { invitationId: string }) => void;
	pendingInvitationId: string | null;
};

export const InvitationList = ({
	invitations,
	isAcceptingInvitation,
	onAcceptInvitation,
	pendingInvitationId,
}: InvitationListProps) => {
	const t = useTranslations("onboarding");
	const tRoles = useTranslations("permissions.roles");
	const format = useFormatter();

	return (
		<div className='space-y-3'>
			{invitations.map((invitation, index) => {
				const isPendingCurrentInvitation = isAcceptingInvitation && pendingInvitationId === invitation.id;
				const organizationName = invitation.organizationName || invitation.organizationId;

				const expiresAtDate =
					invitation.expiresAt instanceof Date ? invitation.expiresAt : new Date(invitation.expiresAt);

				const expiresAt = Number.isNaN(expiresAtDate.getTime())
					? ""
					: format.dateTime(expiresAtDate, { dateStyle: "medium" });

				const roleLabel =
					invitation.role === "owner" || invitation.role === "admin" || invitation.role === "member"
						? tRoles(invitation.role)
						: invitation.role;

				return (
					<m.div
						animate={{ opacity: 1, y: 0 }}
						className='rounded-xl border border-border p-5'
						initial={{ opacity: 0, y: 12 }}
						key={invitation.id}
						transition={{ delay: index * 0.04, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
					>
						<div className='space-y-4'>
							<div className='flex flex-wrap items-center gap-3'>
								<Badge size='sm' variant='dark'>
									{roleLabel}
								</Badge>
								{expiresAt && (
									<span className='text-xs text-muted-foreground'>
										{t("inviteExpires", { date: expiresAt })}
									</span>
								)}
							</div>
							<h2 className='text-lg font-semibold tracking-tight'>{organizationName}</h2>
							<Button
								className='w-full'
								disabled={isAcceptingInvitation && !isPendingCurrentInvitation}
								loading={isPendingCurrentInvitation}
								onClick={() => onAcceptInvitation({ invitationId: invitation.id })}
								size='lg'
							>
								{t("inviteAction")}
							</Button>
						</div>
					</m.div>
				);
			})}
		</div>
	);
};
