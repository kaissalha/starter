"use client";

import { Delete02Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useFormatter, useTranslations } from "next-intl";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@starter/ui/components/alert-dialog";
import { Button } from "@starter/ui/components/button";
import { DrawerFooter } from "@starter/ui/components/drawer";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@starter/ui/components/dropdown-menu";
import { Input } from "@starter/ui/components/input";

import { useContactEditForm, type ContactRow } from "./use-contacts-controller";

export const ContactDetails = ({ contact, onDeleted }: { contact: ContactRow; onDeleted: () => void }) => {
	const { can } = useOrganizationPermissions();
	const t = useTranslations("contacts");
	const format = useFormatter();

	const { cancel, confirmDelete, dirty, draft, remove, setConfirmDelete, setDraft, submit, update } =
		useContactEditForm({ contact, onDeleted });

	const pending = update.isPending || remove.isPending;

	return (
		<>
			{can("workspace.delete") && (
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button
								aria-label={t("actions")}
								className='absolute end-3 top-3 z-10 md:end-12'
								disabled={pending}
								size='icon'
								variant='ghost'
							/>
						}
					>
						<HugeiconsIcon aria-hidden className='scale-110' icon={MoreHorizontalIcon} strokeWidth={1.75} />
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuItem
							onClick={() => {
								remove.reset();
								setConfirmDelete(true);
							}}
							variant='destructive'
						>
							<HugeiconsIcon aria-hidden className='scale-110' icon={Delete02Icon} strokeWidth={1.75} />
							{t("deleteContact")}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
			<form
				className='flex flex-1 flex-col'
				onSubmit={(event) => {
					event.preventDefault();
					submit();
				}}
			>
				<div className='flex-1 px-6 py-6 sm:px-14'>
					<fieldset aria-label={t("details")} className='grid gap-3' disabled={pending}>
						{(["name", "email", "phone"] as const).map((field) => (
							<label
								className='grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 text-sm text-muted-foreground'
								key={field}
							>
								{t(field)}
								<Input
									autoComplete={field === "phone" ? "tel" : field}
									maxLength={{ email: 320, name: 500, phone: 100 }[field]}
									onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
									placeholder={t(`add.${field}`)}
									readOnly={!can("workspace.write")}
									type={{ email: "email", name: "text", phone: "tel" }[field]}
									value={draft[field]}
									variant='ghost'
								/>
							</label>
						))}
					</fieldset>
					<dl className='mt-5 grid grid-cols-[6rem_minmax(0,1fr)] gap-3 text-sm'>
						<dt className='text-muted-foreground'>{t("createdAt")}</dt>
						<dd className='px-3'>
							{format.dateTime(new Date(contact.createdAt), { dateStyle: "medium" })}
						</dd>
					</dl>
					{update.isError && (
						<p className='mt-5 text-sm text-destructive' role='alert'>
							{t("updateFailed")}
						</p>
					)}
				</div>
				{can("workspace.write") && dirty && (
					<DrawerFooter allowSelection={false} className='sticky bottom-0' variant='default'>
						<Button
							className='flex-1'
							disabled={pending}
							onClick={cancel}
							size='lg'
							type='button'
							variant='secondary'
						>
							{t("cancel")}
						</Button>
						<Button
							className='flex-1'
							disabled={
								remove.isPending || (!draft.name.trim() && !draft.email.trim() && !draft.phone.trim())
							}
							loading={update.isPending}
							size='lg'
							type='submit'
						>
							{t("save")}
						</Button>
					</DrawerFooter>
				)}
			</form>
			<AlertDialog
				onOpenChange={(open) => {
					if (!remove.isPending) {
						setConfirmDelete(open);
					}
				}}
				open={can("workspace.delete") && confirmDelete}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("deleteContact")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("deleteDescription", {
								name: contact.name || contact.email || contact.phone || t("contact"),
							})}
						</AlertDialogDescription>
					</AlertDialogHeader>
					{remove.isError && (
						<p className='text-sm text-destructive' role='alert'>
							{t("deleteFailed")}
						</p>
					)}
					<AlertDialogFooter>
						<Button disabled={remove.isPending} onClick={() => setConfirmDelete(false)} variant='secondary'>
							{t("cancel")}
						</Button>
						<Button
							loading={remove.isPending}
							onClick={() => remove.mutate({ contactId: contact.id })}
							variant='destructive'
						>
							{t("deleteContact")}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
};
