"use client";

import { useMemo } from "react";

import { ORPCError } from "@orpc/client";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { Button } from "@starter/ui/components/button";
import { Field, FieldError, FieldLabel } from "@starter/ui/components/field";
import { Form } from "@starter/ui/components/form";
import { Input } from "@starter/ui/components/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@starter/ui/components/select";
import { Skeleton } from "@starter/ui/components/skeleton";
import { Switch } from "@starter/ui/components/switch";
import { cn } from "@starter/ui/lib/utils";

import {
	registrantFields,
	useDomainCheckoutForm,
	type RegistrantField,
	type RegistrantRequirement,
} from "./use-domain-checkout-form";
import type { DomainOffer, useWebsiteDomainsController } from "./use-website-domains-controller";

type Controller = ReturnType<typeof useWebsiteDomainsController>;

const nonCountryRegions = new Set(["EU", "EZ", "QO", "UN", "XA", "XB", "ZZ"]);

const letters = Array.from({ length: 26 }, (_, index) => String.fromCodePoint(65 + index));

const useCountries = () => {
	const locale = useLocale();

	return useMemo(() => {
		const names = new Intl.DisplayNames([locale], { fallback: "none", type: "region" });

		return letters
			.flatMap((first) => letters.map((second) => `${first}${second}`))
			.flatMap((code) => {
				const name = nonCountryRegions.has(code) ? undefined : names.of(code);

				return name ? [{ code, name }] : [];
			})
			.toSorted((left, right) => left.name.localeCompare(right.name, locale));
	}, [locale]);
};

const fieldTypes = {
	address1: { autoComplete: "address-line1", type: "text" },
	address2: { autoComplete: "address-line2", type: "text" },
	city: { autoComplete: "address-level2", type: "text" },
	companyName: { autoComplete: "organization", type: "text" },
	country: { autoComplete: "country", type: "text" },
	email: { autoComplete: "email", type: "email" },
	firstName: { autoComplete: "given-name", type: "text" },
	lastName: { autoComplete: "family-name", type: "text" },
	phone: { autoComplete: "tel", type: "tel" },
	state: { autoComplete: "address-level1", type: "text" },
	zip: { autoComplete: "postal-code", type: "text" },
} satisfies Record<RegistrantField, { autoComplete: string; type: string }>;

const purchaseErrorKey = (error: Controller["purchase"]["error"]) => {
	if (error instanceof ORPCError && error.code === "PRICE_CHANGED") {
		return "priceChanged";
	}

	if (error instanceof ORPCError && error.code === "CONFLICT") {
		return "purchaseUnavailable";
	}

	if (error instanceof ORPCError && error.code === "REGISTRANT_INVALID") {
		return "registrantInvalid";
	}

	return "purchaseError";
};

type Option = { label: string; value: string };

export const OptionSelect = ({
	describedBy,
	id,
	invalid,
	onChange,
	options,
	placeholder,
	value,
}: {
	describedBy?: string;
	id: string;
	invalid: boolean;
	onChange: (value: string) => void;
	options: Array<Option>;
	placeholder: string;
	value: string;
}) => (
	<Select onValueChange={(next) => onChange(next ?? "")} value={value || null}>
		<SelectTrigger aria-describedby={describedBy} aria-invalid={invalid || undefined} className='w-full' id={id}>
			<SelectValue placeholder={placeholder}>
				{(selected: string | null) => options.find((option) => option.value === selected)?.label ?? placeholder}
			</SelectValue>
		</SelectTrigger>
		<SelectPopup className='max-h-72'>
			{options.map((option) => (
				<SelectItem key={option.value} value={option.value}>
					{option.label}
				</SelectItem>
			))}
		</SelectPopup>
	</Select>
);

const RegistrantInput = ({
	countries,
	field,
	form,
}: {
	countries: ReturnType<typeof useCountries>;
	field: RegistrantField;
	form: ReturnType<typeof useDomainCheckoutForm>;
}) => {
	const t = useTranslations("website.domains");
	const invalid = form.invalid.includes(field);
	const id = `registrant-${field}`;
	const errorId = `${id}-error`;
	const restricted = form.requirement(field)?.options ?? null;

	const countryOptions = countries
		.filter((country) => !restricted || restricted.some((option) => option.value === country.code))
		.map((country) => ({ label: country.name, value: country.code }));

	const options = field === "country" ? countryOptions : restricted;

	return (
		<Field
			className={field === "address1" || field === "address2" ? "sm:col-span-2" : undefined}
			invalid={invalid}
			name={field}
		>
			<FieldLabel htmlFor={id}>{t(`registrantFields.${field}`)}</FieldLabel>
			{options ? (
				<OptionSelect
					describedBy={invalid ? errorId : undefined}
					id={id}
					invalid={invalid}
					onChange={(value) => form.setValue(field, value)}
					options={options}
					placeholder={t(field === "country" ? "selectCountry" : "selectOption")}
					value={form.values[field] ?? ""}
				/>
			) : (
				<Input
					aria-describedby={invalid ? errorId : undefined}
					aria-invalid={invalid || undefined}
					autoComplete={fieldTypes[field].autoComplete}
					dir={field === "email" || field === "phone" ? "ltr" : undefined}
					id={id}
					onChange={(event) => form.setValue(field, event.target.value)}
					placeholder={field === "phone" ? "+1 555 010 0100" : undefined}
					required={field !== "address2" && field !== "companyName"}
					type={fieldTypes[field].type}
					value={form.values[field] ?? ""}
				/>
			)}
			{invalid && (
				<FieldError id={errorId} match role='alert'>
					{t(`registrantErrors.${field === "email" || field === "phone" ? field : "required"}`)}
				</FieldError>
			)}
		</Field>
	);
};

const AdditionalInput = ({
	field,
	form,
}: {
	field: RegistrantRequirement;
	form: ReturnType<typeof useDomainCheckoutForm>;
}) => {
	const t = useTranslations("website.domains");

	if (field.type === "notice") {
		return field.description ? (
			<p className='text-sm text-muted-foreground sm:col-span-2'>{field.description}</p>
		) : null;
	}

	const invalid = form.invalid.includes(field.key);
	const id = `registrant-extra-${field.key}`;
	const errorId = `${id}-error`;
	const value = form.values[field.key] ?? "";

	return (
		<Field className='sm:col-span-2' invalid={invalid} name={field.key}>
			<FieldLabel htmlFor={id}>{field.label || field.description || field.key}</FieldLabel>
			{field.options ? (
				<OptionSelect
					describedBy={invalid ? errorId : undefined}
					id={id}
					invalid={invalid}
					onChange={(next) => form.setValue(field.key, next)}
					options={field.options}
					placeholder={t("selectOption")}
					value={value}
				/>
			) : (
				<Input
					aria-describedby={invalid ? errorId : undefined}
					aria-invalid={invalid || undefined}
					id={id}
					onChange={(event) => form.setValue(field.key, event.target.value)}
					required={field.required}
					value={value}
				/>
			)}
			{invalid && (
				<FieldError id={errorId} match role='alert'>
					{t("registrantErrors.required")}
				</FieldError>
			)}
		</Field>
	);
};

export const WebsiteDomainCheckout = ({ controller, offer }: { controller: Controller; offer: DomainOffer }) => {
	const t = useTranslations("website.domains");
	const format = useFormatter();
	const { can } = useOrganizationPermissions();
	const countries = useCountries();
	const form = useDomainCheckoutForm({ controller, offer });
	const price = (value: number) => format.number(value, { currency: "USD", style: "currency" });
	const enabled = Boolean(form.quote.data?.purchaseEnabled);
	const unavailable = form.quote.data?.available === false;

	return (
		<Form
			className='block'
			errors={Object.fromEntries(form.invalid.map((key) => [key, t("registrantErrors.required")]))}
			onSubmit={(event) => {
				event.preventDefault();
				form.submit();
			}}
		>
			<section className='space-y-6 rounded-2xl border p-5 sm:p-6'>
				<div className='flex flex-col gap-4 sm:flex-row sm:justify-between'>
					<div className='min-w-0'>
						<p className='text-xs font-medium text-muted-foreground'>{t("domainLabel")}</p>
						<p className='break-all text-2xl font-semibold' dir='ltr'>
							{offer.domain}
						</p>
					</div>
					<div className='sm:text-end'>
						<p className='text-xs font-medium text-muted-foreground'>{t("priceLabel")}</p>
						{form.quote.isPending ? (
							<Skeleton className='mt-1 h-8 w-24 sm:ms-auto' />
						) : (
							<p
								className={cn(
									"text-2xl font-semibold tabular-nums",
									unavailable && "text-muted-foreground"
								)}
							>
								{unavailable ? t("taken") : price(form.purchasePrice)}
							</p>
						)}
						{!unavailable && (
							<p className='text-xs tabular-nums text-muted-foreground'>
								{t("renewsAt", { price: price(form.renewalPrice) })}
							</p>
						)}
					</div>
				</div>
				{!unavailable && (
					<>
						<div className='space-y-1 rounded-xl bg-muted p-5'>
							<p className='text-sm font-semibold'>{t("ownershipTitle")}</p>
							<p className='text-sm text-muted-foreground'>{t("ownershipNote")}</p>
						</div>
						<fieldset className='space-y-4 border-t pt-6'>
							<legend className='sr-only'>{t("registrant")}</legend>
							<p aria-hidden='true' className='text-sm font-semibold'>
								{t("registrant")}
							</p>
							<div className='grid gap-4 sm:grid-cols-2'>
								{registrantFields.map((field) => (
									<RegistrantInput countries={countries} field={field} form={form} key={field} />
								))}
								{form.additional.map((field) => (
									<AdditionalInput field={field} form={form} key={field.key} />
								))}
							</div>
						</fieldset>
						<label className='flex items-center justify-between gap-3 border-t pt-5 text-sm'>
							<span>{t("autoRenew")}</span>
							<Switch checked={form.autoRenew} onCheckedChange={form.setAutoRenew} />
						</label>
					</>
				)}
			</section>
			{controller.purchase.isError && (
				<p className='mt-4 text-sm text-destructive' role='alert'>
					{t(purchaseErrorKey(controller.purchase.error))}
				</p>
			)}
			<div className='sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-end gap-3 border-t bg-popover px-6 py-4 sm:-mx-8 sm:-mb-8 sm:px-8'>
				{!enabled && form.quote.isSuccess && !unavailable && (
					<p className='me-auto text-sm text-muted-foreground'>{t("registrationDeferred")}</p>
				)}
				<Button
					disabled={!can("workspace.write") || !enabled || unavailable}
					loading={controller.purchase.isPending}
					type='submit'
				>
					{t("getDomain")}
				</Button>
			</div>
		</Form>
	);
};
