"use client";

import { IdentityCardIcon, Stamp01Icon, TextFontIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import { Controller } from "react-hook-form";

import { Button } from "@starter/ui/components/button";
import { Field, FieldControl, FieldError, FieldLabel } from "@starter/ui/components/field";
import { Form } from "@starter/ui/components/form";

import { useCreateOrganizationForm } from "./use-create-organization-form";

type CreateOrganizationFormProps = {
	isCreating: boolean;
	onCreate: (name: string) => Promise<string | null>;
};

const icons = { identity: IdentityCardIcon, stamp: Stamp01Icon, text: TextFontIcon };

export const CreateOrganizationForm = ({ isCreating, onCreate }: CreateOrganizationFormProps) => {
	const t = useTranslations("onboarding");
	const { canContinue, form, handleSubmit } = useCreateOrganizationForm({ onCreate });
	const isSubmitting = isCreating || form.formState.isSubmitting;

	return (
		<Form onSubmit={handleSubmit}>
			<div aria-hidden className='flex h-8 items-center justify-center gap-4 text-info-foreground'>
				{Object.entries(icons).map(([key, icon]) => (
					<HugeiconsIcon className='size-5 scale-110' icon={icon} key={key} strokeWidth={1.75} />
				))}
			</div>
			<Field invalid={Boolean(form.formState.errors.name)} name='name' size='lg'>
				<FieldLabel nativeLabel={false} render={<h1 />} size='lg'>
					{t("fields.name.label")}
				</FieldLabel>
				<Controller
					control={form.control}
					name='name'
					render={({ field }) => (
						<FieldControl
							{...field}
							aria-label={t("fields.name.label")}
							autoComplete='organization'
							disabled={isSubmitting}
							enterKeyHint='go'
							maxLength={100}
							onValueChange={field.onChange}
							placeholder={t("fields.name.placeholder")}
							size='xl'
							variant='subtle'
						/>
					)}
				/>
				{form.formState.errors.name && (
					<FieldError match role='alert'>
						{form.formState.errors.name.message}
					</FieldError>
				)}
			</Field>
			{form.formState.errors.root?.message && (
				<p className='text-sm text-destructive' role='alert'>
					{form.formState.errors.root.message}
				</p>
			)}
			<Button
				aria-busy={isSubmitting}
				className='w-full'
				disabled={!canContinue}
				loading={isSubmitting}
				size='xl'
				type='submit'
				variant='outline'
			>
				{t("createAction")}
			</Button>
		</Form>
	);
};
