"use client";

import { useState, type SubmitEvent } from "react";

import type { ContactFormProps, ContactFormSubmission } from "./contact-form-contracts";

const inputClassName =
	"mt-2 w-full min-w-0 rounded-[min(var(--website-radius-control),1rem)] border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-4 py-3 text-base text-[var(--foreground-primary)] outline-offset-4 focus-visible:outline-2 focus-visible:outline-[var(--foreground-primary)] disabled:opacity-60";

export const ContactForm = ({
	columns,
	copy,
	preview,
	sectionId,
	submit,
	submitWidth = "full",
}: ContactFormProps & {
	submit?: (input: ContactFormSubmission) => Promise<void>;
}) => {
	const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
	const disabled = preview || !submit;

	const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (preview || !submit || status === "pending") {
			return;
		}

		const data = new FormData(event.currentTarget);
		setStatus("pending");

		try {
			await submit({
				email: String(data.get("email") ?? ""),
				message: String(data.get("message") ?? ""),
				name: String(data.get("name") ?? ""),
				phone: String(data.get("phone") ?? ""),
				sectionId,
			});
			setStatus("success");
		} catch {
			setStatus("error");
		}
	};

	const fields = (
		[
			{ autoComplete: "name", label: copy.nameLabel, maxLength: 500, name: "name", type: "text" },
			{ autoComplete: "email", label: copy.emailLabel, maxLength: 320, name: "email", type: "email" },
			{ autoComplete: "tel", label: copy.phoneLabel, maxLength: 100, name: "phone", type: "tel" },
		] as const
	).flatMap(({ label, ...field }) => (label ? [{ ...field, label }] : []));

	const embedded = columns !== undefined;
	const paired = columns === 2 ? fields.slice(0, 2) : [];
	const stacked = fields.slice(paired.length);

	const renderField = (field: (typeof fields)[number]) => (
		<label className='min-w-0 text-sm font-medium' key={field.name}>
			{field.label}
			<input
				autoComplete={field.autoComplete}
				className={inputClassName}
				dir={field.name === "name" ? "auto" : "ltr"}
				maxLength={field.maxLength}
				name={field.name}
				required={field.name !== "phone"}
				type={field.type}
			/>
		</label>
	);

	return (
		<div>
			<div aria-atomic='true' aria-live='polite'>
				{status === "success" && <p className='text-lg leading-relaxed'>{copy.success}</p>}
			</div>
			{status === "success" ? (
				<button
					className='mt-6 min-h-11 underline underline-offset-4'
					onClick={() => setStatus("idle")}
					type='button'
				>
					{copy.anotherLabel}
				</button>
			) : (
				<form aria-label={copy.heading ?? copy.submitLabel} onSubmit={onSubmit}>
					<fieldset className='grid min-w-0 gap-5' disabled={disabled || status === "pending"}>
						{paired.length > 0 && (
							<div className='@container'>
								<div className='grid gap-5 @md:grid-cols-2'>{paired.map(renderField)}</div>
							</div>
						)}
						{stacked.map(renderField)}
						<label className='min-w-0 text-sm font-medium'>
							{copy.messageLabel}
							<textarea
								className={`${inputClassName} resize-y${embedded ? " min-h-[calc(var(--iw-spacing)*40)]" : ""}`}
								dir='auto'
								maxLength={10_000}
								name='message'
								required
								rows={5}
							/>
						</label>
						<button
							className={`min-h-12 rounded-[var(--website-radius-control)] bg-[var(--website-button-fill)] px-6 py-3 font-medium text-[var(--website-button-foreground)] [box-shadow:var(--website-button-ring)] outline-offset-4 focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-60${submitWidth === "fit" ? " @2xl:justify-self-start" : ""}`}
							type='submit'
						>
							{status === "pending" ? copy.pendingLabel : copy.submitLabel}
						</button>
					</fieldset>
					{status === "error" && (
						<p className='mt-4 text-sm' role='alert'>
							{copy.error}
						</p>
					)}
				</form>
			)}
		</div>
	);
};
