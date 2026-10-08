"use client";

import { Children, type ReactNode } from "react";

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useNow, useTranslations } from "next-intl";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@starter/ui/components/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@starter/ui/components/avatar";
import { Button } from "@starter/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@starter/ui/components/dropdown-menu";
import { Skeleton } from "@starter/ui/components/skeleton";

import { OrganizationMemberDialog } from "./organization-member-dialog";
import { useOrganizationMembersController } from "./use-organization-members-controller";

type OrganizationInvitation = NonNullable<
	ReturnType<typeof useOrganizationMembersController>["invitations"]["data"]
>[number];

const getCurrentInvitations = (invitations: Array<OrganizationInvitation>, now: number) => {
	const sorted = invitations.toSorted((a, b) => {
		const aPending = a.status === "pending" && new Date(a.expiresAt).getTime() > now;
		const bPending = b.status === "pending" && new Date(b.expiresAt).getTime() > now;

		return Number(bPending) - Number(aPending) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
	});

	const latest = new Map<string, OrganizationInvitation>();

	for (const invitation of sorted) {
		const email = invitation.email.toLowerCase();

		if (!latest.has(email)) {
			latest.set(email, invitation);
		}
	}

	return [...latest.values()].filter((invitation) => invitation.status === "pending");
};

const OrganizationMemberCard = ({
	children,
	email,
	image,
	name,
	role,
	status,
}: {
	children: ReactNode;
	email: string;
	image?: string | null;
	name?: string;
	role: string;
	status?: "pending" | "expired";
}) => {
	const t = useTranslations("settings.team");
	const roleLabel = role === "owner" || role === "admin" || role === "member" ? t(`roles.${role}`) : role;

	return (
		<li className='flex items-center gap-3 py-4'>
			<Avatar size='default'>
				{image && <AvatarImage alt={name ?? email} src={image} />}
				<AvatarFallback>{(name || email).slice(0, 1).toUpperCase()}</AvatarFallback>
			</Avatar>
			<div className='min-w-0 flex-1'>
				<p className='truncate text-sm font-medium' title={name || email}>
					{name || email}
				</p>
				{name && (
					<p className='truncate text-xs text-muted-foreground' title={email}>
						{email}
					</p>
				)}
				{status && (
					<p className={status === "expired" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
						{t(`status.${status}`)}
					</p>
				)}
			</div>
			<span className='shrink-0 text-xs text-muted-foreground'>{roleLabel}</span>
			<div className='flex w-8 shrink-0 justify-end'>
				{Children.toArray(children).length > 0 && (
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button
									aria-label={t("actions.menu", { name: name || email })}
									size='icon-sm'
									variant='ghost'
								/>
							}
						>
							<HugeiconsIcon
								aria-hidden
								className='scale-110'
								icon={MoreHorizontalIcon}
								strokeWidth={1.75}
							/>
						</DropdownMenuTrigger>
						<DropdownMenuContent align='end'>{children}</DropdownMenuContent>
					</DropdownMenu>
				)}
			</div>
		</li>
	);
};

const OrganizationMemberConfirmation = ({
	controller,
}: {
	controller: ReturnType<typeof useOrganizationMembersController>;
}) => {
	const t = useTranslations("settings.team");
	const { confirmation, mutation, permissions } = controller;

	return (
		<AlertDialog
			onOpenChange={(open) => {
				if (!open && !mutation.isPending) {
					controller.setConfirmation(null);
				}
			}}
			open={confirmation !== null && permissions.can("workspace.delete")}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{t(confirmation?.type === "cancel" ? "confirm.cancelTitle" : "confirm.removeTitle")}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{t(
							confirmation?.type === "cancel" ? "confirm.cancelDescription" : "confirm.removeDescription",
							{ name: confirmation?.name ?? "" }
						)}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<Button
						disabled={mutation.isPending}
						onClick={() => controller.setConfirmation(null)}
						variant='outline'
					>
						{t("back")}
					</Button>
					<Button
						disabled={mutation.isPending}
						loading={mutation.isPending}
						onClick={() => {
							if (confirmation) {
								mutation.mutate(confirmation);
							}
						}}
						variant='destructive'
					>
						{t("confirm.submit")}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};

const OrganizationMembersContent = ({
	organizationId,
	permissions,
}: {
	organizationId: string;
	permissions: ReturnType<typeof useOrganizationPermissions>;
}) => {
	const now = useNow({ updateInterval: 60_000 });
	const t = useTranslations("settings.team");
	const controller = useOrganizationMembersController({ organizationId, permissions });
	const { dialog, invitations, memberList, members, mutation, page } = controller;
	const pendingInvitations = getCurrentInvitations(invitations.data ?? [], now.getTime());
	const loading = members.isPending || invitations.isPending;
	const error = members.isError || invitations.isError;

	return (
		<div className='flex max-w-3xl flex-col gap-6'>
			<div className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2'>
				<h2 className='text-xl font-semibold'>{t("title")}</h2>
				{permissions.can("invitation.create") && (
					<Button onClick={() => controller.setDialog({ type: "invite" })}>{t("invite.cta")}</Button>
				)}
				<p className='col-span-2 text-sm text-muted-foreground'>{t("description")}</p>
			</div>
			{loading && <Skeleton aria-label={t("loading")} className='h-20 w-full' corners='rounded' role='status' />}
			{error && (
				<div className='flex items-center justify-between gap-3' role='alert'>
					<p className='text-sm'>{t("loadFailed")}</p>
					<Button
						onClick={() => {
							members.refetch();
							invitations.refetch();
						}}
						variant='outline'
					>
						{t("retry")}
					</Button>
				</div>
			)}
			<ul className='divide-y divide-border border-y border-border'>
				{memberList.map((member) => (
					<OrganizationMemberCard
						email={member.user.email}
						image={member.user.image}
						key={member.id}
						name={member.user.name}
						role={member.role}
					>
						{member.canManage && (
							<DropdownMenuItem
								disabled={mutation.isPending}
								onClick={() => controller.setDialog({ memberId: member.id, type: "role" })}
							>
								{t("manageAccess.title")}
							</DropdownMenuItem>
						)}
						{member.canRemove && (
							<DropdownMenuItem
								aria-label={t("removeMember", { name: member.user.name })}
								disabled={mutation.isPending}
								onClick={() =>
									controller.setConfirmation({
										id: member.id,
										name: member.user.name,
										type: "remove",
									})
								}
								variant='destructive'
							>
								{t("actions.remove")}
							</DropdownMenuItem>
						)}
					</OrganizationMemberCard>
				))}
			</ul>
			{members.isSuccess && members.data.total === 0 && (
				<p className='text-sm text-muted-foreground'>{t("empty.noMembers")}</p>
			)}
			{(page > 0 || (members.data?.total ?? 0) > 50) && (
				<div className='flex gap-2'>
					<Button
						disabled={page === 0 || members.isPending}
						onClick={() => controller.setPage(page - 1)}
						size='sm'
						variant='outline'
					>
						{t("previous")}
					</Button>
					<Button
						disabled={members.isPending || (page + 1) * 50 >= (members.data?.total ?? 0)}
						onClick={() => controller.setPage(page + 1)}
						size='sm'
						variant='outline'
					>
						{t("next")}
					</Button>
				</div>
			)}
			<div className='flex flex-col gap-3'>
				<h3 className='text-sm font-semibold'>{t("invitations")}</h3>
				{invitations.isSuccess && pendingInvitations.length === 0 && (
					<p className='text-sm text-muted-foreground'>{t("noInvitations")}</p>
				)}
				<ul className='divide-y divide-border border-y border-border'>
					{pendingInvitations.map((invitation) => (
						<OrganizationMemberCard
							email={invitation.email}
							key={invitation.id}
							role={invitation.role}
							status={new Date(invitation.expiresAt).getTime() > now.getTime() ? "pending" : "expired"}
						>
							{permissions.can("invitation.create") &&
								(invitation.role === "admin" || invitation.role === "member") && (
									<DropdownMenuItem
										disabled={mutation.isPending}
										onClick={() => mutation.mutate({ id: invitation.id, type: "resend" })}
									>
										{t("actions.resend")}
									</DropdownMenuItem>
								)}
							{permissions.can("invitation.cancel") && (
								<DropdownMenuItem
									aria-label={t("cancelInvitation", { email: invitation.email })}
									disabled={mutation.isPending}
									onClick={() =>
										controller.setConfirmation({
											id: invitation.id,
											name: invitation.email,
											type: "cancel",
										})
									}
									variant='destructive'
								>
									{t("actions.cancelInvitation")}
								</DropdownMenuItem>
							)}
						</OrganizationMemberCard>
					))}
				</ul>
			</div>
			{dialog && (
				<OrganizationMemberDialog
					controller={controller}
					key={dialog.type === "invite" ? "invite" : dialog.memberId}
				/>
			)}
			<OrganizationMemberConfirmation controller={controller} />
		</div>
	);
};

export const OrganizationMembers = () => {
	const t = useTranslations("settings.team");
	const permissions = useOrganizationPermissions();

	if (permissions.isLoading) {
		return <Skeleton className='h-40 w-full' corners='rounded' />;
	}

	if (!permissions.can("workspace.read") || !permissions.organizationId) {
		return <p className='text-sm text-muted-foreground'>{t("empty.noOrganization")}</p>;
	}

	return (
		<OrganizationMembersContent
			key={permissions.organizationId}
			organizationId={permissions.organizationId}
			permissions={permissions}
		/>
	);
};
