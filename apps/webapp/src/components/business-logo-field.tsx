"use client";

import { useState } from "react";

import Image from "next/image";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { MediaPickerContent } from "@/components/media/media-picker";
import { apiClient } from "@/lib/api-client";
import { brandLogoScale, type BrandLogo } from "@starter/infinite-brand";
import { Button } from "@starter/ui/components/button";
import { Dialog, DialogPopup, DialogTitle } from "@starter/ui/components/dialog";
import { Slider } from "@starter/ui/components/slider";
import { toast } from "@starter/ui/components/toaster";
import { ToggleGroup, ToggleGroupItem } from "@starter/ui/components/toggle-group";

type BusinessLogoChange = (logo: BrandLogo | undefined) => Promise<void> | void;

export const useBusinessLogo = ({ onSaved }: { onSaved?: () => Promise<void> | void } = {}) => {
	const t = useTranslations("businessLogo");
	const queryClient = useQueryClient();

	const mutation = useMutation(
		apiClient.brands.setLogo.mutationOptions({
			onError: () => toast.error(t("failed")),
			onSuccess: async () => {
				await Promise.all([
					onSaved?.(),
					...[apiClient.brands.get.key(), apiClient.websites.get.key(), apiClient.linkPages.get.key()].map(
						(queryKey) => queryClient.invalidateQueries({ queryKey })
					),
				]);
			},
		})
	);

	const change: BusinessLogoChange = async (logo) => {
		try {
			await mutation.mutateAsync({ logo: logo ?? null });
		} catch {
			return;
		}
	};

	return { change, pending: mutation.isPending };
};

const LogoImageEditor = ({
	disabled,
	logo,
	name,
	onChange,
	onReplace,
}: {
	disabled: boolean;
	logo: BrandLogo;
	name: string;
	onChange: BusinessLogoChange;
	onReplace: () => void;
}) => {
	const t = useTranslations("businessLogo");
	const [scale, setScale] = useState(logo.scale);

	return (
		<>
			<div className='flex h-32 items-center justify-center overflow-hidden rounded-xl bg-muted p-4'>
				<Image
					alt={name}
					className='h-[calc(var(--logo-scale)*2.5rem)] w-auto max-w-full object-contain'
					height={80}
					src={logo.src}
					style={{ "--logo-scale": scale }}
					unoptimized
					width={240}
				/>
			</div>
			<Button className='w-full' disabled={disabled} onClick={onReplace} type='button' variant='outline'>
				{t("replace")}
			</Button>
			<div className='space-y-2'>
				<div className='flex items-center justify-between gap-3 text-sm'>
					<span className='font-medium'>{t("size")}</span>
					<span className='text-muted-foreground tabular-nums'>{Math.round(scale * 100)}%</span>
				</div>
				<Slider
					aria-label={t("size")}
					className='h-6'
					disabled={disabled}
					max={brandLogoScale.max}
					min={brandLogoScale.min}
					onValueChange={(next) => setScale(Number(next))}
					onValueCommitted={(next) => onChange({ ...logo, scale: Number(next) })}
					step={brandLogoScale.step}
					value={scale}
				/>
			</div>
		</>
	);
};

export const BusinessLogoField = ({
	disabled = false,
	logo,
	name,
	onChange,
}: {
	disabled?: boolean;
	logo: BrandLogo | undefined;
	name: string;
	onChange: BusinessLogoChange;
}) => {
	const t = useTranslations("businessLogo");
	const tCommon = useTranslations("common");
	const [picking, setPicking] = useState(false);

	return (
		<div className='space-y-4'>
			<ToggleGroup
				aria-label={t("type")}
				className='w-full'
				disabled={disabled}
				onValueChange={([next]) => {
					if (next === "text" && logo) {
						onChange(undefined);
					}

					if (next === "image" && !logo) {
						setPicking(true);
					}
				}}
				size='lg'
				value={[logo ? "image" : "text"]}
				variant='outline'
			>
				<ToggleGroupItem className='flex-1' value='text'>
					{t("text")}
				</ToggleGroupItem>
				<ToggleGroupItem className='flex-1' value='image'>
					{t("image")}
				</ToggleGroupItem>
			</ToggleGroup>
			{logo ? (
				<LogoImageEditor
					disabled={disabled}
					key={`${logo.src}:${logo.scale}`}
					logo={logo}
					name={name}
					onChange={onChange}
					onReplace={() => setPicking(true)}
				/>
			) : (
				<div className='flex h-32 items-center justify-center rounded-xl bg-muted px-4'>
					<span className='truncate text-2xl font-semibold'>{name}</span>
				</div>
			)}
			<Dialog onOpenChange={setPicking} open={picking}>
				<DialogPopup className='flex max-h-[90dvh] flex-col' closeLabel={tCommon("close")} size='lg'>
					<DialogTitle>{t("title")}</DialogTitle>
					{picking && (
						<MediaPickerContent
							disabled={disabled}
							kind='image'
							onSelect={async (media) => {
								await onChange({ scale: logo?.scale ?? brandLogoScale.default, src: media.url });
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
