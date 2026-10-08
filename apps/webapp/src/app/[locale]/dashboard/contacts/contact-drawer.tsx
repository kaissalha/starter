"use client";

import { useState } from "react";

import { Flag01Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useFormatter, useTranslations } from "next-intl";

import { DashboardDrawer, DashboardDrawerHeader } from "@/app/[locale]/dashboard/components/dashboard-drawer";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { Button } from "@starter/ui/components/button";
import { DrawerDescription, DrawerFooter, DrawerPanel } from "@starter/ui/components/drawer";
import { Input } from "@starter/ui/components/input";
import { Skeleton } from "@starter/ui/components/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@starter/ui/components/tabs";

import { ContactDetails } from "./contact-details";
import { ContactMessages } from "./contact-messages";
import { ContactProfile } from "./contact-profile";
import { useContactDrawer, useContactForm } from "./use-contacts-controller";

export const ContactDrawer = ({
	contactId: requestedId,
	contactTab,
	messageId,
	onClose,
	onMessageChange,
	onSaved,
	onTabChange,
}: {
	contactId: string | null;
	contactTab: "details" | "messages" | "activity";
	messageId: string | null;
	onClose: () => void;
	onMessageChange: (messageId: string | null) => void;
	onSaved: (id: string) => void;
	onTabChange: (tab: "details" | "messages" | "activity") => void;
}) => {
	const t = useTranslations("contacts");
	const format = useFormatter();
	const { can } = useOrganizationPermissions();
	const [contactId, setContactId] = useState(requestedId ?? "new");

	if (requestedId !== null && requestedId !== contactId) {
		setContactId(requestedId);
	}

	const query = useContactDrawer(contactId, requestedId !== null);
	const contact = query.data;

	return (
		<DashboardDrawer
			closeLabel={t("close")}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
			open={requestedId !== null && (requestedId !== "new" || can("workspace.write"))}
		>
			<DrawerDescription className='sr-only'>{t("details")}</DrawerDescription>
			{contactId === "new" ? (
				<>
					<DashboardDrawerHeader
						leading={
							<HugeiconsIcon
								aria-hidden
								className='size-6 scale-110'
								icon={UserCircleIcon}
								strokeWidth={1.75}
							/>
						}
						title={t("newContact")}
					/>
					<CreateContactForm onCancel={onClose} onSaved={onSaved} />
				</>
			) : (
				<DrawerPanel allowSelection={false} padding='none' scrollFade={false} variant='surface'>
					<Tabs
						className='flex min-h-full flex-col'
						key={contactId}
						onValueChange={(value) => {
							if (value === "details" || value === "messages" || value === "activity") {
								onTabChange(value);
							}
						}}
						spacing='none'
						value={contactTab}
					>
						<ContactProfile contact={contact} />
						<TabsList aria-label={t("details")} surface='panel'>
							{(["details", "messages", "activity"] as const).map((tab) => (
								<TabsTrigger key={tab} size='lg' value={tab}>
									{t(tab)}
								</TabsTrigger>
							))}
						</TabsList>
						{query.isPending && (
							<div aria-label={t("loading")} className='space-y-5 px-6 py-6 sm:px-14' role='status'>
								<Skeleton className='h-10 w-full' />
								<Skeleton className='h-10 w-full' />
								<Skeleton className='h-10 w-full' />
							</div>
						)}
						{query.isError && (
							<div className='space-y-3 px-6 py-6 sm:px-14' role='alert'>
								<p>{t("loadFailed")}</p>
								<Button onClick={() => query.refetch()} variant='outline'>
									{t("retry")}
								</Button>
							</div>
						)}
						{contact && (
							<>
								<TabsContent className='flex flex-1 flex-col' keepMounted value='details'>
									<ContactDetails contact={contact} key={contact.id} onDeleted={onClose} />
								</TabsContent>
								<TabsContent padding='panel' value='activity'>
									<div className='flex items-center gap-3 text-sm'>
										<HugeiconsIcon
											aria-hidden
											className='size-5 shrink-0 scale-110 text-muted-foreground'
											icon={Flag01Icon}
											strokeWidth={1.75}
										/>
										<span>{t("contactCreated")}</span>
										<time
											className='ms-auto text-xs text-muted-foreground'
											dateTime={contact.createdAt}
										>
											{format.dateTime(new Date(contact.createdAt), { dateStyle: "medium" })}
										</time>
									</div>
								</TabsContent>
								<TabsContent padding='panel' value='messages'>
									<ContactMessages
										contactId={contact.id}
										messageId={messageId}
										onMessageChange={onMessageChange}
									/>
								</TabsContent>
							</>
						)}
					</Tabs>
				</DrawerPanel>
			)}
		</DashboardDrawer>
	);
};

const CreateContactForm = ({ onCancel, onSaved }: { onCancel: () => void; onSaved: (id: string) => void }) => {
	const t = useTranslations("contacts");
	const { draft, mutation, setDraft, submit } = useContactForm(onSaved);

	return (
		<form
			className='contents'
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<DrawerPanel allowSelection={false} padding='spacious' variant='surface'>
				<fieldset aria-label={t("details")} className='grid gap-3' disabled={mutation.isPending}>
					{(["name", "email", "phone"] as const).map((field) => (
						<label
							className='grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 text-sm text-muted-foreground'
							key={field}
						>
							{t(field)}
							<Input
								autoComplete={field === "phone" ? "tel" : field}
								maxLength={field === "phone" ? 100 : 320}
								onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
								placeholder={t(`add.${field}`)}
								type={{ email: "email", name: "text", phone: "tel" }[field]}
								value={draft[field]}
								variant='ghost'
							/>
						</label>
					))}
				</fieldset>
				{mutation.error && (
					<p className='mt-5 text-sm text-destructive-foreground' role='alert'>
						{t("saveFailed")}
					</p>
				)}
			</DrawerPanel>
			<DrawerFooter allowSelection={false} variant='default'>
				<Button
					className='flex-1'
					disabled={mutation.isPending}
					onClick={onCancel}
					size='lg'
					type='button'
					variant='secondary'
				>
					{t("cancel")}
				</Button>
				<Button
					className='flex-1'
					disabled={!draft.name.trim() && !draft.email.trim() && !draft.phone.trim()}
					loading={mutation.isPending}
					size='lg'
					type='submit'
				>
					{t("addContact")}
				</Button>
			</DrawerFooter>
		</form>
	);
};
