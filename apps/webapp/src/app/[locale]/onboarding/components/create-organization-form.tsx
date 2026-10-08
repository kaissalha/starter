"use client";

import {
	ArrowLeft01Icon,
	Briefcase01Icon,
	BulbIcon,
	EarthIcon,
	Flag01Icon,
	IdentityCardIcon,
	Location01Icon,
	Stamp01Icon,
	TextFontIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import { Controller } from "react-hook-form";

import { Button } from "@starter/ui/components/button";
import { Field, FieldControl, FieldError, FieldLabel } from "@starter/ui/components/field";
import { Form } from "@starter/ui/components/form";
import { cn } from "@starter/ui/lib/utils";

import { useCreateOrganizationForm, type OnboardingBusiness } from "./use-create-organization-form";

type CreateOrganizationFormProps = {
	initialBusiness?: OnboardingBusiness;
	isCreating: boolean;
	onCreate: (business: OnboardingBusiness) => Promise<string | null>;
};

const fieldOptions = {
	location: {
		autoComplete: "address-level2",
		iconClassName: "text-info-foreground",
		icons: { flag: Flag01Icon, location: Location01Icon, world: EarthIcon },
		maxLength: 200,
	},
	name: {
		autoComplete: "organization",
		iconClassName: "text-info-foreground",
		icons: { identity: IdentityCardIcon, stamp: Stamp01Icon, text: TextFontIcon },
		maxLength: 100,
	},
	type: {
		autoComplete: "off",
		iconClassName: "text-chart-1",
		icons: { business: Briefcase01Icon, idea: BulbIcon, identity: IdentityCardIcon },
		maxLength: 120,
	},
};

export const CreateOrganizationForm = ({ initialBusiness, isCreating, onCreate }: CreateOrganizationFormProps) => {
	const t = useTranslations("onboarding");

	const { back, canContinue, fieldName, form, handleSubmit, step } = useCreateOrganizationForm({
		initialBusiness,
		onCreate,
	});

	const isSubmitting = isCreating || form.formState.isSubmitting;
	const { iconClassName, icons, ...inputOptions } = fieldOptions[fieldName];

	return (
		<Form onSubmit={handleSubmit}>
			<div className='relative flex h-8 items-center justify-center'>
				{step > 0 && (
					<Button
						aria-label={t("back")}
						className='absolute start-0'
						disabled={isSubmitting}
						onClick={back}
						size='icon'
						type='button'
						variant='ghost'
					>
						<HugeiconsIcon aria-hidden className='scale-110' icon={ArrowLeft01Icon} strokeWidth={1.75} />
					</Button>
				)}
				<div aria-hidden className={cn("flex items-center gap-4", iconClassName)}>
					{Object.entries(icons).map(([key, icon]) => (
						<HugeiconsIcon className='size-5 scale-110' icon={icon} key={key} strokeWidth={1.75} />
					))}
				</div>
			</div>
			<Field invalid={Boolean(form.formState.errors[fieldName])} name={fieldName} size='lg'>
				<FieldLabel nativeLabel={false} render={<h1 />} size='lg'>
					{t(`fields.${fieldName}.label`)}
				</FieldLabel>
				<Controller
					control={form.control}
					name={fieldName}
					render={({ field }) => (
						<FieldControl
							{...field}
							{...inputOptions}
							aria-label={t(`fields.${fieldName}.label`)}
							disabled={isSubmitting}
							enterKeyHint={step < 2 ? "next" : "go"}
							onValueChange={field.onChange}
							placeholder={t(`fields.${fieldName}.placeholder`)}
							size='xl'
							variant='subtle'
						/>
					)}
				/>
				{form.formState.errors[fieldName] && (
					<FieldError match role='alert'>
						{form.formState.errors[fieldName]?.message}
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
				{step === 2 ? t("createAction") : t("next")}
			</Button>
			<ol
				aria-label={t("step", { current: step + 1, total: 3 })}
				className='absolute inset-x-0 bottom-8 flex items-center justify-center gap-2'
			>
				{(["name", "location", "type"] as const).map((name) => (
					<li aria-current={name === fieldName ? "step" : undefined} key={name}>
						<span
							aria-hidden
							className={cn(
								"block h-1.5 w-1.5 rounded-full bg-muted-foreground/20",
								name === fieldName && "w-6 bg-muted-foreground/60"
							)}
						/>
						<span className='sr-only'>{t(`fields.${name}.label`)}</span>
					</li>
				))}
			</ol>
		</Form>
	);
};
