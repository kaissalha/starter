"use client";

import { useCallback, useState } from "react";

import { useTranslations } from "next-intl";

import { useAuthSession } from "@/components/auth/auth-session-context";
import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@starter/ui/components/avatar";
import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Skeleton } from "@starter/ui/components/skeleton";
import { toast } from "@starter/ui/components/toaster";

import { SettingsCard } from "./settings-card";

export const ProfileTab = () => {
	const t = useTranslations("settings");
	const tCommon = useTranslations("common");
	const { data: session } = useAuthSession();
	const user = session?.user;

	const [name, setName] = useState(user?.name ?? "");
	const [isUpdatingName, setIsUpdatingName] = useState(false);

	const userInitials = user?.name
		?.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase();

	const handleUpdateName = useCallback(async () => {
		if (isUpdatingName || !name.trim() || name.trim().length > 32) {
			return;
		}

		setIsUpdatingName(true);

		try {
			const result = await authClient.updateUser({
				name: name.trim(),
			});

			if (result.error) {
				toast.error(tCommon("saveError"));

				return;
			}

			toast.success(tCommon("saved"));
		} catch {
			toast.error(tCommon("saveError"));
		} finally {
			setIsUpdatingName(false);
		}
	}, [isUpdatingName, name, tCommon]);

	if (!user) {
		return (
			<div className='flex max-w-3xl flex-col gap-6'>
				<div className='rounded-lg border border-border bg-card'>
					<div className='flex items-start justify-between gap-4 p-6'>
						<div className='flex flex-col gap-2'>
							<Skeleton className='h-5 w-24' />
							<Skeleton className='h-4 w-48' />
						</div>
						<Skeleton className='h-16 w-16' corners='circle' />
					</div>
					<div className='flex items-center justify-between gap-4 border-t border-border bg-muted/30 px-6 py-4'>
						<Skeleton className='h-3 w-32' />
					</div>
				</div>

				<div className='rounded-lg border border-border bg-card'>
					<div className='flex flex-col gap-2 p-6'>
						<Skeleton className='h-5 w-28' />
						<Skeleton className='h-4 w-56' />
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
						<Skeleton className='h-5 w-16' />
						<Skeleton className='h-4 w-44' />
					</div>
					<div className='px-6 pb-6'>
						<Skeleton className='h-9 w-full max-w-xs' />
					</div>
					<div className='flex items-center justify-between gap-4 border-t border-border bg-muted/30 px-6 py-4'>
						<Skeleton className='h-3 w-40' />
						<Skeleton className='h-8 w-16' />
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className='flex max-w-3xl flex-col gap-6'>
			<SettingsCard
				action={
					<Avatar size='lg'>
						<AvatarImage alt={user.name} src={user.image ?? ""} />
						<AvatarFallback>{userInitials}</AvatarFallback>
					</Avatar>
				}
				description={t("profile.avatar.description")}
				footerHint={t("profile.avatar.hint")}
				title={t("profile.avatar.title")}
			/>

			<SettingsCard
				description={t("profile.displayName.description")}
				footer={
					<Button
						disabled={name.trim() === user.name || !name.trim() || name.trim().length > 32}
						loading={isUpdatingName}
						onClick={handleUpdateName}
						size='sm'
					>
						{tCommon("save")}
					</Button>
				}
				footerHint={t("profile.displayName.hint")}
				title={t("profile.displayName.title")}
			>
				<Input
					aria-label={t("profile.fields.name")}
					autoComplete='name'
					className='max-w-xs'
					disabled={isUpdatingName}
					maxLength={32}
					onChange={(e) => setName(e.target.value)}
					placeholder={t("profile.fields.namePlaceholder")}
					value={name}
				/>
			</SettingsCard>

			<SettingsCard
				description={t("profile.email.description")}
				footerHint={t("profile.email.hint")}
				title={t("profile.email.title")}
			>
				<Input
					aria-label={t("profile.fields.email")}
					autoComplete='email'
					className='max-w-xs'
					readOnly
					type='email'
					value={user.email}
				/>
			</SettingsCard>
		</div>
	);
};
