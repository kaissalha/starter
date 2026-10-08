"use client";

import { useState } from "react";

import Image from "next/image";

import { useTranslations } from "next-intl";

import { MediaPickerContent } from "@/components/media/media-picker";
import { authClient } from "@/lib/auth-client";
import { Button } from "@starter/ui/components/button";
import { Dialog, DialogPopup, DialogTitle } from "@starter/ui/components/dialog";
import { toast } from "@starter/ui/components/toaster";

type OrganizationLogoUploadProps = {
	canEdit: boolean;
	organization: {
		id: string;
		logo?: string | null;
		name: string;
	};
};

export const OrganizationLogoUpload = ({ canEdit, organization }: OrganizationLogoUploadProps) => {
	const t = useTranslations("businessLogo");
	const tCommon = useTranslations("common");
	const { refetch } = authClient.useActiveOrganization();
	const [picking, setPicking] = useState(false);
	const [pending, setPending] = useState(false);

	const save = async (logo: string) => {
		setPending(true);

		try {
			const result = await authClient.organization.update({ data: { logo }, organizationId: organization.id });

			if (result.error) {
				toast.error(t("failed"));

				return;
			}

			await refetch();
			toast.success(t("saved"));
		} catch {
			toast.error(t("failed"));
		} finally {
			setPending(false);
		}
	};

	return (
		<div className='space-y-4'>
			<div className='flex h-32 items-center justify-center overflow-hidden rounded-xl bg-muted p-4'>
				{organization.logo ? (
					<Image
						alt={organization.name}
						className='h-10 w-auto max-w-full object-contain'
						height={80}
						src={organization.logo}
						unoptimized
						width={240}
					/>
				) : (
					<span className='truncate text-2xl font-semibold'>{organization.name}</span>
				)}
			</div>
			<div className='flex gap-2'>
				<Button
					className='flex-1'
					disabled={!canEdit || pending}
					onClick={() => setPicking(true)}
					type='button'
					variant='outline'
				>
					{t("replace")}
				</Button>
				{organization.logo && (
					<Button disabled={!canEdit || pending} onClick={() => save("")} type='button' variant='ghost'>
						{tCommon("delete")}
					</Button>
				)}
			</div>
			<Dialog onOpenChange={setPicking} open={picking}>
				<DialogPopup className='flex max-h-[90dvh] flex-col' closeLabel={tCommon("close")} size='lg'>
					<DialogTitle>{t("title")}</DialogTitle>
					{picking && (
						<MediaPickerContent
							disabled={pending}
							kind='image'
							onSelect={async (media) => {
								await save(media.url);
								setPicking(false);
							}}
							purpose='logo'
						/>
					)}
				</DialogPopup>
			</Dialog>
		</div>
	);
};
