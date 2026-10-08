"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";

import type { OrganizationRole } from "@starter/server/permissions";
import { Button } from "@starter/ui/components/button";
import {
	Credenza,
	CredenzaContent,
	CredenzaDescription,
	CredenzaHeader,
	CredenzaTitle,
} from "@starter/ui/components/credenza";
import { Input } from "@starter/ui/components/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@starter/ui/components/select";

import type { useOrganizationMembersController } from "./use-organization-members-controller";

export const OrganizationMemberDialog = ({
	controller,
}: {
	controller: ReturnType<typeof useOrganizationMembersController>;
}) => {
	const t = useTranslations("settings.team");
	const tCommon = useTranslations("common");
	const { dialog, memberList, mutation, permissions, setDialog } = controller;
	const member = dialog?.type === "role" ? memberList.find((item) => item.id === dialog.memberId) : undefined;
	const initialRole = member?.role;

	const [role, setRole] = useState<Exclude<OrganizationRole, "owner">>(
		initialRole === "admin" ? initialRole : "member"
	);

	const [email, setEmail] = useState("");
	const inviting = dialog?.type === "invite";
	const title = t(inviting ? "invite.title" : "manageAccess.title");
	const roles = ["member", "admin"] as const;
	const allowed = inviting ? permissions.can("invitation.create") : member?.canManage;
	const disabled = mutation.isPending || !allowed;

	return (
		<Credenza
			onOpenChange={(open) => {
				if (!open && !mutation.isPending) {
					setDialog(null);
				}
			}}
			open={dialog !== null}
		>
			<CredenzaContent aria-label={title} closeLabel={tCommon("close")}>
				<div className='flex flex-col gap-6 py-6 sm:py-3'>
					<CredenzaHeader>
						<CredenzaTitle>{title}</CredenzaTitle>
						<CredenzaDescription>
							{inviting
								? t("invite.description")
								: t("manageAccess.description", { name: member?.user.name ?? "" })}
						</CredenzaDescription>
					</CredenzaHeader>
					<form
						className='flex flex-col gap-5 px-4 sm:px-0'
						onSubmit={(event) => {
							event.preventDefault();

							if (disabled) {
								return;
							}

							if (inviting) {
								mutation.mutate({ email, role, type: "invite" });
							} else if (member) {
								mutation.mutate({ memberId: member.id, role, type: "role" });
							}
						}}
					>
						{inviting ? (
							<label className='grid gap-2 text-sm font-medium'>
								{t("invite.fields.email.label")}
								<Input
									autoComplete='email'
									disabled={disabled}
									onChange={(event) => setEmail(event.target.value)}
									placeholder={t("invite.fields.email.placeholder")}
									required
									type='email'
									value={email}
								/>
							</label>
						) : (
							<p className='break-all text-sm text-muted-foreground'>{member?.user.email}</p>
						)}
						<div className='grid gap-2'>
							<p className='text-sm font-medium'>{t("invite.fields.role.label")}</p>
							<Select
								disabled={disabled}
								items={roles.map((value) => ({ label: t(`roles.${value}`), value }))}
								onValueChange={(value) => {
									if (value === "admin" || value === "member") {
										setRole(value);
									}
								}}
								value={role}
							>
								<SelectTrigger aria-label={t("invite.fields.role.label")} className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectPopup>
									{roles.map((value) => (
										<SelectItem key={value} value={value}>
											{t(`roles.${value}`)}
										</SelectItem>
									))}
								</SelectPopup>
							</Select>
							<p className='text-sm text-muted-foreground'>{t(`roleDescriptions.${role}`)}</p>
						</div>
						<div className='flex gap-3'>
							<Button
								className='flex-1'
								disabled={mutation.isPending}
								onClick={() => setDialog(null)}
								size='lg'
								type='button'
								variant='secondary'
							>
								{t("back")}
							</Button>
							<Button
								className='flex-1'
								disabled={disabled || (inviting ? !email.trim() : role === member?.role)}
								loading={mutation.isPending}
								size='lg'
								type='submit'
							>
								{t(inviting ? "invite.submit" : "manageAccess.save")}
							</Button>
						</div>
					</form>
				</div>
			</CredenzaContent>
		</Credenza>
	);
};
