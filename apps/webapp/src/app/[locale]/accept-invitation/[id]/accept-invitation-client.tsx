"use client";

import { useTranslations } from "next-intl";

import { Logo } from "@/components/logo";
import { Link, useRouter } from "@/i18n/navigation";
import { Alert, AlertDescription, AlertTitle } from "@starter/ui/components/alert";
import { Badge } from "@starter/ui/components/badge";
import { Button } from "@starter/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@starter/ui/components/card";

import { useInvitationController } from "./use-invitation-controller";

type AcceptInvitationClientProps = {
	invitation?: { email: string; organizationName: string; role: string };
	invitationId: string;
	status: "pending" | "mismatch" | "unavailable" | "error";
	userEmail: string;
};

export const AcceptInvitationClient = ({
	invitation,
	invitationId,
	status,
	userEmail,
}: AcceptInvitationClientProps) => {
	const t = useTranslations("acceptInvitation");
	const tCommon = useTranslations("common");
	const router = useRouter();

	const emailMismatch =
		status === "mismatch" ||
		Boolean(invitation && invitation.email.trim().toLowerCase() !== userEmail.trim().toLowerCase());

	const unavailable = status === "unavailable" || invitation?.role === "owner";
	const canRespond = status === "pending" && Boolean(invitation) && !emailMismatch && !unavailable;
	const { acceptedOrganizationId, error, pending, respond } = useInvitationController({ canRespond, invitationId });
	const role = invitation?.role;
	const roleName = role === "owner" || role === "admin" || role === "member" ? t(`roles.${role}`) : t("defaultRole");

	return (
		<main className='flex min-h-screen items-center justify-center bg-background px-6 py-12'>
			<div className='w-full max-w-md space-y-8'>
				<Link
					aria-label={t("home")}
					className='flex items-center justify-center gap-3'
					href='/'
					prefetch={true}
				>
					<Logo className='size-10' />
				</Link>
				<Card variant='elevated'>
					<CardHeader className='text-center'>
						<Badge className='mx-auto' size='sm' variant='outline'>
							{t("eyebrow")}
						</Badge>
						<CardTitle size='lg'>
							{invitation
								? t("titleWithOrganization", { organizationName: invitation.organizationName })
								: t("title")}
						</CardTitle>
						{invitation && (
							<p className='text-sm text-muted-foreground'>
								{t("description", { email: invitation.email, role: roleName })}
							</p>
						)}
					</CardHeader>
					<CardContent spacing='default'>
						{emailMismatch && (
							<Alert variant='warning'>
								<AlertTitle>{t("mismatch.title")}</AlertTitle>
								<AlertDescription>{t("mismatch.description", { userEmail })}</AlertDescription>
							</Alert>
						)}
						{unavailable && (
							<Alert variant='warning'>
								<AlertTitle>{t("unavailable.title")}</AlertTitle>
								<AlertDescription>{t("unavailable.description")}</AlertDescription>
							</Alert>
						)}
						{status === "error" && (
							<Alert variant='error'>
								<AlertTitle>{t("loadError.title")}</AlertTitle>
								<AlertDescription>{t("loadError.description")}</AlertDescription>
							</Alert>
						)}
						{error && (
							<p className='text-sm text-destructive' role='alert'>
								{t(`messages.${error}`)}
							</p>
						)}
						<div className='flex flex-col gap-2'>
							{(canRespond || acceptedOrganizationId) && (
								<Button
									className='w-full'
									disabled={Boolean(pending)}
									loading={pending === "accept"}
									onClick={() => respond("accept")}
									size='xl'
								>
									{acceptedOrganizationId ? t("openWorkspace") : t("accept")}
								</Button>
							)}
							{canRespond && !acceptedOrganizationId && (
								<Button
									className='w-full'
									disabled={Boolean(pending)}
									loading={pending === "reject"}
									onClick={() => respond("reject")}
									size='xl'
									variant='outline'
								>
									{t("decline")}
								</Button>
							)}
							{emailMismatch && (
								<Button
									className='w-full'
									disabled={Boolean(pending)}
									loading={pending === "signOut"}
									onClick={() => respond("signOut")}
									size='xl'
								>
									{t("signInAsOther")}
								</Button>
							)}
							{status === "error" && (
								<Button onClick={() => router.refresh()} size='xl'>
									{t("retry")}
								</Button>
							)}
						</div>
						<p className='text-center text-xs text-muted-foreground'>
							{t("signedInAs", { email: userEmail })} ·{" "}
							<Link className='underline underline-offset-2' href='/dashboard' prefetch={true}>
								{tCommon("back")}
							</Link>
						</p>
					</CardContent>
				</Card>
			</div>
		</main>
	);
};
