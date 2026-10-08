"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { apiClient } from "@/lib/api-client";
import { Checkbox } from "@starter/ui/components/checkbox";
import { Label } from "@starter/ui/components/label";
import { Skeleton } from "@starter/ui/components/skeleton";
import { toast } from "@starter/ui/components/toaster";

import { useNotificationTranslator } from "../notifications/use-notification-translator";
import { SettingsCard } from "./settings-card";

export const NotificationsTab = () => {
	const t = useTranslations("notifications");
	const tNotification = useNotificationTranslator();
	const tSettings = useTranslations("settings.notifications");
	const tCommon = useTranslations("common");
	const queryClient = useQueryClient();
	const settings = useQuery(apiClient.notificationSettings.getAll.queryOptions());

	const update = useMutation(
		apiClient.notificationSettings.update.mutationOptions({
			onError: () => toast.error(tCommon("saveError")),
			onSettled: () => queryClient.invalidateQueries({ queryKey: apiClient.notificationSettings.key() }),
		})
	);

	const categories = [...new Set(settings.data?.map(({ category }) => category) ?? [])];

	return (
		<div className='flex max-w-3xl flex-col gap-6'>
			<SettingsCard description={tSettings("description")} title={tSettings("title")}>
				{settings.isPending ? (
					<div className='flex flex-col gap-3'>
						<Skeleton className='h-5 w-32' />
						<Skeleton className='h-10 w-full' />
					</div>
				) : (
					<div className='flex flex-col gap-6'>
						{categories.map((category) => (
							<fieldset className='flex flex-col gap-2' key={category}>
								<legend className='mb-2 text-sm font-medium'>{tNotification.category(category)}</legend>
								{settings.data
									?.filter((setting) => setting.category === category)
									.map((setting) => (
										<div
											className='flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3'
											key={setting.type}
										>
											<span className='text-sm'>
												{tNotification.type({ key: "setting", type: setting.type })}
											</span>
											<div className='flex items-center gap-4'>
												{setting.channels.map((channel) => (
													<Label key={channel.channel}>
														<Checkbox
															checked={channel.enabled}
															disabled={channel.locked || update.isPending}
															onCheckedChange={(enabled) =>
																update.mutate({
																	channel: channel.channel,
																	enabled,
																	type: setting.type,
																})
															}
														/>
														<span>{t(`channels.${channel.channel}`)}</span>
													</Label>
												))}
											</div>
										</div>
									))}
							</fieldset>
						))}
					</div>
				)}
			</SettingsCard>
		</div>
	);
};
