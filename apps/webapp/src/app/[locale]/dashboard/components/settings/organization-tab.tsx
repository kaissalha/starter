"use client";

import { useTranslations } from "next-intl";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { authClient } from "@/lib/auth-client";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@starter/ui/components/alert-dialog";
import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Skeleton } from "@starter/ui/components/skeleton";

import { OrganizationLogoUpload } from "./organization-logo-upload";
import { SettingsCard } from "./settings-card";
import { useDeleteOrganizationController } from "./use-delete-organization-controller";
import { useOrganizationSettingsForm } from "./use-organization-settings-form";

type EditableOrganization = {
	id: string;
	logo?: string | null;
	name: string;
};

const OrganizationSettingsForm = ({
	canEdit,
	organization,
}: {
	canEdit: boolean;
	organization: EditableOrganization;
}) => {
	const t = useTranslations("settings.organization");
	const tCommon = useTranslations("common");

	const { canSave, handleSave, isSaving, name, setName } = useOrganizationSettingsForm({
		canEdit,
		organization,
	});

	return (
		<div className='flex max-w-3xl flex-col gap-6'>
			<SettingsCard
				description={t("name.description")}
				footer={
					<Button disabled={!canSave} loading={isSaving} onClick={handleSave} size='sm'>
						{tCommon("save")}
					</Button>
				}
				footerHint={canEdit ? t("name.hint") : t("readOnly")}
				title={t("name.title")}
			>
				<Input
					aria-label={t("name.title")}
					autoComplete='organization'
					className='max-w-xs'
					disabled={!canEdit}
					onChange={(e) => setName(e.target.value)}
					placeholder={t("name.placeholder")}
					value={name}
				/>
			</SettingsCard>

			<SettingsCard
				description={t("logo.description")}
				footerHint={canEdit ? t("logo.hint") : t("readOnly")}
				title={t("logo.title")}
			>
				<OrganizationLogoUpload canEdit={canEdit} organization={organization} />
			</SettingsCard>
		</div>
	);
};

const DeleteOrganizationCard = ({ organization }: { organization: EditableOrganization }) => {
	const t = useTranslations("settings.organization.delete");
	const tCommon = useTranslations("common");
	const controller = useDeleteOrganizationController({ organization });

	return (
		<>
			<SettingsCard
				action={
					<Button onClick={() => controller.setOpen(true)} size='sm' variant='destructive'>
						{t("action")}
					</Button>
				}
				description={t("description")}
				title={t("title")}
			/>
			<AlertDialog onOpenChange={controller.setOpen} open={controller.open}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("dialogTitle")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("dialogDescription", { name: organization.name })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<Input
						aria-label={t("confirmLabel")}
						autoComplete='off'
						disabled={controller.isDeleting}
						onChange={(e) => controller.setConfirmation(e.target.value)}
						placeholder={organization.name}
						value={controller.confirmation}
					/>
					<AlertDialogFooter>
						<Button
							disabled={controller.isDeleting}
							onClick={() => controller.setOpen(false)}
							variant='outline'
						>
							{tCommon("cancel")}
						</Button>
						<Button
							disabled={!controller.canConfirm}
							loading={controller.isDeleting}
							onClick={controller.handleDelete}
							variant='destructive'
						>
							{t("confirmSubmit")}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
};

export const OrganizationTab = () => {
	const t = useTranslations("settings.organization");
	const { data: activeOrganization, isPending: isOrgPending } = authClient.useActiveOrganization();
	const { can, isLoading: permissionsLoading } = useOrganizationPermissions();
	const canEdit = can("organization.update");
	const isLoading = isOrgPending || permissionsLoading;

	if (isLoading) {
		return (
			<div className='flex max-w-3xl flex-col gap-6'>
				<div className='rounded-lg border border-border bg-card'>
					<div className='flex flex-col gap-2 p-6'>
						<Skeleton className='h-5 w-40' />
						<Skeleton className='h-4 w-64' />
					</div>
					<div className='px-6 pb-6'>
						<Skeleton className='h-9 w-full max-w-xs' />
					</div>
					<div className='flex items-center justify-between gap-4 border-t border-border bg-muted/30 px-6 py-4'>
						<Skeleton className='h-3 w-36' />
						<Skeleton className='h-8 w-16' />
					</div>
				</div>
				<div className='rounded-lg border border-border bg-card'>
					<div className='flex flex-col gap-2 p-6'>
						<Skeleton className='h-5 w-32' />
						<Skeleton className='h-4 w-72' />
					</div>
					<div className='px-6 pb-6'>
						<Skeleton className='h-9 w-full max-w-md' />
					</div>
					<div className='flex items-center justify-between gap-4 border-t border-border bg-muted/30 px-6 py-4'>
						<Skeleton className='h-3 w-44' />
						<Skeleton className='h-8 w-16' />
					</div>
				</div>
			</div>
		);
	}

	if (!activeOrganization) {
		return (
			<div className='flex max-w-3xl flex-col gap-6'>
				<p className='text-sm text-muted-foreground'>{t("empty")}</p>
			</div>
		);
	}

	return (
		<div className='flex max-w-3xl flex-col gap-6'>
			<OrganizationSettingsForm
				canEdit={canEdit}
				key={`${activeOrganization.id}:${activeOrganization.name}:${activeOrganization.logo ?? ""}`}
				organization={activeOrganization}
			/>
			{can("organization.delete") && (
				<DeleteOrganizationCard key={activeOrganization.id} organization={activeOrganization} />
			)}
		</div>
	);
};
