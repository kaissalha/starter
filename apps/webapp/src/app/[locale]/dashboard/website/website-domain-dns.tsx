"use client";

import { Add01Icon, Delete02Icon, Edit02Icon, LockKeyIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";

import { dnsTypes, dnsTypeSchema, useDomainDnsController } from "./use-domain-dns-controller";
import { OptionSelect } from "./website-domain-checkout";

const RecordForm = ({ controller, zone }: { controller: ReturnType<typeof useDomainDnsController>; zone: string }) => {
	const t = useTranslations("website.domains");
	const { draft } = controller;

	if (!draft) {
		return null;
	}

	return (
		<form
			className='grid gap-3 rounded-xl border p-4 sm:grid-cols-[7rem_1fr]'
			onSubmit={(event) => {
				event.preventDefault();
				controller.save();
			}}
		>
			<label className='space-y-1 text-sm'>
				<span>{t("type")}</span>
				<OptionSelect
					id='dns-record-type'
					invalid={false}
					onChange={(value) => {
						const type = dnsTypeSchema.safeParse(value);

						if (type.success) {
							controller.setDraft({ type: type.data });
						}
					}}
					options={dnsTypes.map((type) => ({ label: type, value: type }))}
					placeholder={t("type")}
					value={draft.type}
				/>
			</label>
			<label className='space-y-1 text-sm'>
				<span>{t("name")}</span>
				<span className='flex items-center gap-2' dir='ltr'>
					<Input
						autoCapitalize='none'
						onChange={(event) => controller.setDraft({ name: event.target.value })}
						placeholder='@'
						spellCheck={false}
						value={draft.name}
					/>
					<span className='shrink-0 text-muted-foreground'>.{zone}</span>
				</span>
			</label>
			{draft.type === "MX" && (
				<label className='space-y-1 text-sm'>
					<span>{t("priority")}</span>
					<Input
						inputMode='numeric'
						onChange={(event) => controller.setDraft({ mxPriority: event.target.value })}
						value={draft.mxPriority}
					/>
				</label>
			)}
			<label className='space-y-1 text-sm sm:col-span-2'>
				<span>{t("value")}</span>
				<Input
					autoCapitalize='none'
					dir='ltr'
					onChange={(event) => controller.setDraft({ value: event.target.value })}
					required
					spellCheck={false}
					value={draft.value}
				/>
			</label>
			<div className='flex gap-2 sm:col-span-2'>
				<Button loading={controller.pending} type='submit'>
					{t("saveRecord")}
				</Button>
				<Button disabled={controller.pending} onClick={controller.cancel} type='button' variant='ghost'>
					{t("cancel")}
				</Button>
			</div>
		</form>
	);
};

export const WebsiteDomainDns = ({ domainId }: { domainId: string }) => {
	const t = useTranslations("website.domains");
	const { can } = useOrganizationPermissions();
	const controller = useDomainDnsController({ domainId });
	const { query } = controller;

	if (query.isPending) {
		return <p role='status'>{t("loading")}</p>;
	}

	if (query.isError) {
		return (
			<div className='space-y-3'>
				<p className='text-sm text-destructive' role='alert'>
					{t("loadError")}
				</p>
				<Button onClick={() => query.refetch()} variant='outline'>
					{t("retry")}
				</Button>
			</div>
		);
	}

	return (
		<div className='space-y-4'>
			{!controller.draft && can("workspace.write") && (
				<Button onClick={controller.create} variant='outline'>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Add01Icon} strokeWidth={1.75} />
					{t("addRecord")}
				</Button>
			)}
			<RecordForm controller={controller} zone={query.data.zone} />
			{controller.error && (
				<p className='text-sm text-destructive' role='alert'>
					{t("recordError")}
				</p>
			)}
			<div className='overflow-x-auto rounded-lg border'>
				<table className='w-full text-start text-sm'>
					<thead className='bg-muted/40 text-xs text-muted-foreground'>
						<tr>
							<th className='px-3 py-2 text-start font-medium'>{t("type")}</th>
							<th className='px-3 py-2 text-start font-medium'>{t("name")}</th>
							<th className='px-3 py-2 text-start font-medium'>{t("value")}</th>
							<th className='w-20 px-3 py-2'>
								<span className='sr-only'>{t("actions")}</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{query.data.records.map((record) => (
							<tr className='border-t' key={record.id}>
								<td className='px-3 py-2 font-medium'>{record.type}</td>
								<td className='break-all px-3 py-2' dir='ltr'>
									{record.name || "@"}
								</td>
								<td className='break-all px-3 py-2 font-mono text-xs' dir='ltr'>
									{record.mxPriority === null ? record.value : `${record.mxPriority} ${record.value}`}
								</td>
								<td className='px-3 py-2'>
									{record.locked ? (
										<HugeiconsIcon
											aria-label={t("recordLocked")}
											className='scale-110 text-muted-foreground'
											icon={LockKeyIcon}
											role='img'
											strokeWidth={1.75}
										/>
									) : (
										<span className='flex gap-1'>
											<Button
												aria-label={t("editRecord")}
												disabled={!can("workspace.write") || controller.pending}
												onClick={() => controller.edit(record)}
												size='icon-sm'
												variant='ghost'
											>
												<HugeiconsIcon
													aria-hidden='true'
													className='scale-110'
													icon={Edit02Icon}
													strokeWidth={1.75}
												/>
											</Button>
											<Button
												aria-label={t("deleteRecord")}
												disabled={!can("workspace.delete") || controller.pending}
												onClick={() => controller.remove(record.id)}
												size='icon-sm'
												variant='ghost'
											>
												<HugeiconsIcon
													aria-hidden='true'
													className='scale-110'
													icon={Delete02Icon}
													strokeWidth={1.75}
												/>
											</Button>
										</span>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
};
