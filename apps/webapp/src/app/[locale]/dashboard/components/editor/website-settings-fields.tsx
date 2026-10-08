"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";

import { websiteSettingsSchema, type WebsiteSettings } from "@starter/infinite-website";
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
import { Radio, RadioGroup } from "@starter/ui/components/radio-group";
import { Switch } from "@starter/ui/components/switch";
import { Textarea } from "@starter/ui/components/textarea";

import type { useWebsiteLanguages } from "./use-website-languages";

export const WebsiteSettingsFields = ({
	controller,
	initial,
}: {
	controller: ReturnType<typeof useWebsiteLanguages>;
	initial: WebsiteSettings;
}) => {
	const t = useTranslations("website.settings");
	const [value, setValue] = useState(initial);
	const [error, setError] = useState(false);
	const [confirmUnpublish, setConfirmUnpublish] = useState(false);

	const update = (integration: WebsiteSettings["integrations"][number]) =>
		setValue({
			...value,
			integrations: value.integrations.map((item) => (item.id === integration.id ? integration : item)),
		});

	const changed = JSON.stringify(value) !== JSON.stringify(initial);

	const save = async () => {
		const parsed = websiteSettingsSchema.safeParse(value);

		if (!parsed.success) {
			setError(true);

			return;
		}

		setError(false);

		try {
			await controller.edit({ operation: "update-settings", settings: parsed.data });
		} catch {
			setError(true);
		}
	};

	return (
		<form
			className='flex min-h-0 flex-1 flex-col'
			onSubmit={(event) => {
				event.preventDefault();
				save();
			}}
		>
			<fieldset
				aria-label={t("integrations")}
				className='min-h-0 flex-1 space-y-6 overflow-y-auto p-4 md:p-10'
				disabled={!controller.enabled || controller.pending}
			>
				<h2 className='text-xl font-semibold'>{t("integrations")}</h2>
				<div className='space-y-6'>
					<label className='block space-y-2'>
						<span>{t("googleAnalyticsId")}</span>
						<Input
							dir='ltr'
							onChange={(event) => setValue({ ...value, googleAnalyticsId: event.target.value })}
							placeholder='G-XXXXXXXXXX'
							value={value.googleAnalyticsId}
						/>
					</label>
					{value.integrations.map((integration) => (
						<section className='space-y-4 rounded-xl border border-border p-4' key={integration.id}>
							<div className='flex items-center gap-3'>
								<Input
									aria-label={t("integrationName")}
									onChange={(event) => update({ ...integration, name: event.target.value })}
									value={integration.name}
								/>
								<Switch
									aria-label={t("enabled")}
									checked={integration.enabled}
									onCheckedChange={(enabled) => update({ ...integration, enabled })}
								/>
							</div>
							<RadioGroup
								aria-label={t("placement")}
								className='flex flex-wrap'
								onValueChange={(placement) => {
									if (
										placement === "head" ||
										placement === "body-start" ||
										placement === "body-end"
									) {
										update({ ...integration, placement });
									}
								}}
								value={integration.placement}
							>
								{(["head", "body-start", "body-end"] as const).map((placement) => (
									<label className='flex items-center gap-2 text-sm' key={placement}>
										<Radio value={placement} />
										{t(placement)}
									</label>
								))}
							</RadioGroup>
							<Textarea
								aria-label={t("customCode")}
								className='min-h-40'
								dir='ltr'
								onChange={(event) => update({ ...integration, code: event.target.value })}
								value={integration.code}
							/>
							<Button
								onClick={() =>
									setValue({
										...value,
										integrations: value.integrations.filter((item) => item.id !== integration.id),
									})
								}
								type='button'
								variant='ghost'
							>
								{t("remove")}
							</Button>
						</section>
					))}
					<Button
						disabled={value.integrations.length >= 20}
						onClick={() =>
							setValue({
								...value,
								integrations: [
									...value.integrations,
									{
										code: "",
										enabled: true,
										id: crypto.randomUUID(),
										name: t("customCode"),
										placement: "head",
									},
								],
							})
						}
						type='button'
						variant='outline'
					>
						{t("addIntegration")}
					</Button>
				</div>
				{controller.website?.publication.publishedAt && (
					<Button onClick={() => setConfirmUnpublish(true)} type='button' variant='outline'>
						{t("unpublish")}
					</Button>
				)}
				{error && (
					<p className='text-sm text-destructive' role='alert'>
						{t("invalid")}
					</p>
				)}
			</fieldset>
			<div className='flex gap-3 border-t border-border p-4'>
				<Button
					className='min-w-0 flex-1'
					disabled={!changed || controller.pending}
					onClick={() => {
						setValue(initial);
						setError(false);
					}}
					size='lg'
					type='button'
					variant='outline'
				>
					{t("cancel")}
				</Button>
				<Button
					className='min-w-0 flex-1'
					disabled={!changed || !controller.enabled || controller.pending}
					loading={controller.pending}
					size='lg'
					type='submit'
				>
					{t("save")}
				</Button>
			</div>
			<AlertDialog
				onOpenChange={(open) => {
					if (!controller.unpublishing) {
						setConfirmUnpublish(open);
					}
				}}
				open={confirmUnpublish}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("unpublishTitle")}</AlertDialogTitle>
						<AlertDialogDescription>{t("unpublishDescription")}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<Button
							disabled={controller.unpublishing}
							onClick={() => setConfirmUnpublish(false)}
							type='button'
							variant='secondary'
						>
							{t("cancel")}
						</Button>
						<Button
							loading={controller.unpublishing}
							onClick={() =>
								controller.unpublish(undefined, { onSettled: () => setConfirmUnpublish(false) })
							}
							type='button'
							variant='destructive'
						>
							{t("unpublish")}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</form>
	);
};
