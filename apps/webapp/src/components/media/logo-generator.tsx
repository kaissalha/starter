"use client";

import { useState } from "react";

import Image from "next/image";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { apiClient } from "@/lib/api-client";
import { Button } from "@starter/ui/components/button";
import { Field, FieldLabel } from "@starter/ui/components/field";
import { Textarea } from "@starter/ui/components/textarea";

import type { UploadedMedia } from "./use-media-upload";

export const LogoGenerator = ({
	disabled,
	onSelect,
}: {
	disabled?: boolean;
	onSelect: (media: UploadedMedia) => Promise<void>;
}) => {
	const t = useTranslations("media.logo");
	const tMedia = useTranslations("media");
	const queryClient = useQueryClient();
	const [prompt, setPrompt] = useState("");
	const [saving, setSaving] = useState(false);

	const generate = useMutation(
		apiClient.library.generateLogo.mutationOptions({
			onSuccess: () =>
				Promise.all([
					queryClient.invalidateQueries({ queryKey: apiClient.media.list.key() }),
					queryClient.invalidateQueries({ queryKey: apiClient.library.list.key() }),
				]),
		})
	);

	const logo = generate.data?.url ? { ...generate.data, url: generate.data.url } : null;
	const busy = disabled || generate.isPending || saving;

	return (
		<>
			<div className='min-h-0 flex-1 space-y-3 overflow-y-auto'>
				<form
					className='space-y-3'
					onSubmit={(event) => {
						event.preventDefault();
						generate.mutate({ prompt });
					}}
				>
					<Field>
						<FieldLabel>{t("style")}</FieldLabel>
						<Textarea
							aria-label={t("style")}
							maxLength={1000}
							onChange={(event) => setPrompt(event.target.value)}
							value={prompt}
						/>
					</Field>
					<Button
						className='w-full'
						disabled={busy}
						loading={generate.isPending}
						type='submit'
						variant='outline'
					>
						{logo ? t("regenerate") : t("generate")}
					</Button>
				</form>
				{generate.isPending && (
					<p className='text-sm text-muted-foreground' role='status'>
						{t("generating")}
					</p>
				)}
				{generate.isError && (
					<p className='text-sm text-destructive' role='alert'>
						{t("failed")}
					</p>
				)}
				{logo && !generate.isPending && (
					<Image
						alt={logo.name}
						className='aspect-video w-full rounded-xl bg-muted object-contain p-6'
						height={320}
						src={logo.url}
						unoptimized
						width={320}
					/>
				)}
			</div>
			<Button
				className='w-full'
				disabled={!logo || busy}
				loading={saving}
				onClick={async () => {
					if (!logo) {
						return;
					}

					setSaving(true);

					try {
						await onSelect({ ...logo, kind: "image" });
					} finally {
						setSaving(false);
					}
				}}
				size='lg'
			>
				{tMedia("use")}
			</Button>
		</>
	);
};
