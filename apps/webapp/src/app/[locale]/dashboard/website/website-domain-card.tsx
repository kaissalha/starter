"use client";

import { useState } from "react";

import {
	Alert02Icon,
	Clock01Icon,
	Copy01Icon,
	Delete02Icon,
	MoreHorizontalIcon,
	ServerStack01Icon,
	Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useFormatter, useTranslations } from "next-intl";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { Alert, AlertDescription } from "@starter/ui/components/alert";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@starter/ui/components/alert-dialog";
import { Badge } from "@starter/ui/components/badge";
import { Button } from "@starter/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@starter/ui/components/dropdown-menu";
import { Switch } from "@starter/ui/components/switch";
import { ToggleGroup, ToggleGroupItem } from "@starter/ui/components/toggle-group";
import { useCopyToClipboard } from "@starter/ui/hooks/use-copy-to-clipboard";

import type { DomainGroup, useWebsiteDomainsController } from "./use-website-domains-controller";

type Controller = ReturnType<typeof useWebsiteDomainsController>;

type DisplayRecord = { name: string; ready: boolean; type: string; value: string };

const nameservers = ["ns1.vercel-dns.com", "ns2.vercel-dns.com"];

const statusVariants = {
	disconnecting: "default",
	dns: "suboptimal",
	live: "optimal",
	ownership: "suboptimal",
	tls: "suboptimal",
} as const;

const relativeName = ({ apex, name }: { apex: string; name: string }) => {
	if (name === apex) {
		return "@";
	}

	return name.endsWith(`.${apex}`) ? name.slice(0, -apex.length - 1) : name;
};

const uniqueRecords = (records: Array<DisplayRecord>) =>
	records.filter(
		(record, index) =>
			records.findIndex(
				(other) => other.type === record.type && other.name === record.name && other.value === record.value
			) === index
	);

const ownershipRecords = (group: DomainGroup) =>
	uniqueRecords(
		group.domains.flatMap((domain) => (domain.ownershipRecord ? [{ ...domain.ownershipRecord, ready: false }] : []))
	);

const groupRecords = (group: DomainGroup) =>
	uniqueRecords([
		...ownershipRecords(group),
		...group.domains.flatMap((domain) =>
			domain.records.map((record) => ({ ...record, ready: record.ready ?? false }))
		),
	]);

export const CopyValue = ({ value }: { value: string }) => {
	const tCommon = useTranslations("common");
	const { copyToClipboard, isCopied } = useCopyToClipboard();

	return (
		<Button
			aria-label={isCopied ? tCommon("copiedToClipboard") : tCommon("copyToClipboard")}
			onClick={() => copyToClipboard(value)}
			size='icon-sm'
			type='button'
			variant='ghost'
		>
			<HugeiconsIcon
				aria-hidden='true'
				className='scale-110'
				icon={isCopied ? Tick02Icon : Copy01Icon}
				strokeWidth={1.75}
			/>
		</Button>
	);
};

const RecordTable = ({ apex, records }: { apex: string; records: Array<DisplayRecord> }) => {
	const t = useTranslations("website.domains");

	return (
		<div className='overflow-x-auto rounded-lg border'>
			<table className='w-full text-start text-sm'>
				<thead className='bg-muted/40 text-xs text-muted-foreground'>
					<tr>
						<th className='px-3 py-2 text-start font-medium'>{t("type")}</th>
						<th className='px-3 py-2 text-start font-medium'>{t("name")}</th>
						<th className='px-3 py-2 text-start font-medium'>{t("value")}</th>
						<th className='w-10 px-3 py-2'>
							<span className='sr-only'>{t("recordStatus")}</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{records.map((record) => (
						<tr className='border-t' key={`${record.type}:${record.name}:${record.value}`}>
							<td className='px-3 py-2 font-medium'>{record.type}</td>
							<td className='px-3 py-2' dir='ltr'>
								<span className='flex items-center gap-1'>
									<span className='break-all'>{relativeName({ apex, name: record.name })}</span>
									<CopyValue value={relativeName({ apex, name: record.name })} />
								</span>
							</td>
							<td className='px-3 py-2 font-mono text-xs' dir='ltr'>
								<span className='flex items-center gap-1'>
									<span className='break-all'>{record.value}</span>
									<CopyValue value={record.value} />
								</span>
							</td>
							<td className='px-3 py-2'>
								<HugeiconsIcon
									aria-label={t(record.ready ? "recordReady" : "recordWaiting")}
									className={
										record.ready
											? "scale-110 text-success-foreground"
											: "scale-110 text-muted-foreground"
									}
									icon={record.ready ? Tick02Icon : Clock01Icon}
									role='img'
									strokeWidth={1.75}
								/>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};

const DomainSetup = ({ controller, group }: { controller: Controller; group: DomainGroup }) => {
	const t = useTranslations("website.domains");
	const { can } = useOrganizationPermissions();
	const { lead } = group;
	const conflicts = uniqueRecords(group.domains.flatMap((domain) => domain.conflicts));
	const ownership = ownershipRecords(group);

	return (
		<div className='space-y-4'>
			{!group.registration && (
				<ToggleGroup
					aria-label={t("method")}
					disabled={!can("workspace.write") || controller.pending}
					onValueChange={([method]) => {
						if (method === "records" || method === "nameservers") {
							controller.changeMethod.mutate({ domainId: lead.id, method });
						}
					}}
					value={[lead.method]}
					variant='outline'
				>
					<ToggleGroupItem value='records'>{t("methodRecords")}</ToggleGroupItem>
					<ToggleGroupItem value='nameservers'>{t("methodNameservers")}</ToggleGroupItem>
				</ToggleGroup>
			)}
			{lead.method === "nameservers" && ownership.length === 0 ? (
				<div className='space-y-2'>
					<p className='text-sm text-muted-foreground'>{t("nameserverInstructions")}</p>
					<ul className='divide-y rounded-lg border'>
						{nameservers.map((nameserver) => (
							<li
								className='flex items-center justify-between gap-2 px-3 py-2 font-mono text-sm'
								dir='ltr'
								key={nameserver}
							>
								{nameserver}
								<CopyValue value={nameserver} />
							</li>
						))}
					</ul>
				</div>
			) : (
				<div className='space-y-2'>
					<p className='text-sm text-muted-foreground'>{t("recordInstructions")}</p>
					<RecordTable
						apex={group.apex}
						records={lead.method === "nameservers" ? ownership : groupRecords(group)}
					/>
				</div>
			)}
			{conflicts.length > 0 && (
				<div className='space-y-2'>
					<p className='text-sm font-medium'>{t("removeRecords")}</p>
					<RecordTable apex={group.apex} records={conflicts} />
				</div>
			)}
			{group.domains.some((domain) => domain.caaBlocked) && (
				<Alert variant='warning'>
					<HugeiconsIcon aria-hidden='true' icon={Alert02Icon} strokeWidth={1.75} />
					<AlertDescription>{t("caaBlocked")}</AlertDescription>
				</Alert>
			)}
		</div>
	);
};

const RegistrationDetails = ({ controller, group }: { controller: Controller; group: DomainGroup }) => {
	const t = useTranslations("website.domains");
	const format = useFormatter();
	const { can } = useOrganizationPermissions();
	const { registration } = group;

	if (!registration) {
		return null;
	}

	const code =
		controller.transferCode.variables?.registrationId === registration.id
			? controller.transferCode.data
			: undefined;

	return (
		<div className='space-y-3 rounded-lg bg-muted/30 p-3 text-sm'>
			<div className='flex flex-wrap items-center justify-between gap-2'>
				<span className='text-muted-foreground'>
					{registration.expiresAt
						? t(registration.autoRenew ? "renewsOn" : "expiresOn", {
								date: format.dateTime(new Date(registration.expiresAt), { dateStyle: "medium" }),
							})
						: t("registered")}
				</span>
				<label className='flex items-center gap-2'>
					<span>{t("autoRenew")}</span>
					<Switch
						checked={registration.autoRenew}
						disabled={
							!can("workspace.write") ||
							controller.autoRenew.isPending ||
							registration.status !== "active"
						}
						onCheckedChange={(autoRenew) =>
							controller.autoRenew.mutate({ autoRenew, registrationId: registration.id })
						}
					/>
				</label>
			</div>
			{code ? (
				<div className='flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2'>
					<span className='text-muted-foreground'>{t("transferCode")}</span>
					<span className='flex items-center gap-1 font-mono' dir='ltr'>
						{code.authCode}
						<CopyValue value={code.authCode} />
					</span>
				</div>
			) : (
				can("workspace.delete") && (
					<Button
						loading={controller.transferCode.isPending}
						onClick={() => controller.transferCode.mutate({ registrationId: registration.id })}
						size='sm'
						variant='outline'
					>
						{t("getTransferCode")}
					</Button>
				)
			)}
		</div>
	);
};

export const WebsiteDomainCard = ({ controller, group }: { controller: Controller; group: DomainGroup }) => {
	const t = useTranslations("website.domains");
	const { can } = useOrganizationPermissions();
	const [confirmDisconnect, setConfirmDisconnect] = useState(false);
	const primary = group.domains.find((domain) => domain.primary);
	const primaryCandidates = group.domains.filter((domain) => domain.status === "connected" && !domain.primary);

	const managedDns =
		group.lead.ownershipVerified && (group.lead.method === "nameservers" || Boolean(group.registration));

	return (
		<section className='space-y-4 rounded-xl border p-4 sm:p-5'>
			<div className='flex flex-wrap items-start justify-between gap-3'>
				<div className='min-w-0 space-y-1'>
					<h3 className='break-all font-medium' dir='ltr'>
						{group.apex}
					</h3>
					{primary && (
						<p className='text-xs text-muted-foreground'>
							{t("primaryHostname", { hostname: primary.hostname })}
						</p>
					)}
				</div>
				<div className='flex items-center gap-1'>
					<Badge variant={statusVariants[group.status]}>{t(`status.${group.status}`)}</Badge>
					{can("workspace.write") && group.status !== "disconnecting" && (
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<Button
										aria-label={t("actions")}
										disabled={controller.pending}
										size='icon-sm'
										variant='ghost'
									/>
								}
							>
								<HugeiconsIcon
									aria-hidden='true'
									className='scale-110'
									icon={MoreHorizontalIcon}
									strokeWidth={1.75}
								/>
							</DropdownMenuTrigger>
							<DropdownMenuContent>
								{primaryCandidates.map((domain) => (
									<DropdownMenuItem
										key={domain.id}
										onClick={() => controller.primary.mutate({ domainId: domain.id })}
									>
										<span dir='ltr'>{t("makePrimaryHostname", { hostname: domain.hostname })}</span>
									</DropdownMenuItem>
								))}
								{managedDns && (
									<DropdownMenuItem
										onClick={() => controller.setView({ domain: group.lead, name: "dns" })}
									>
										<HugeiconsIcon
											aria-hidden='true'
											className='scale-110'
											icon={ServerStack01Icon}
											strokeWidth={1.75}
										/>
										{t("manageDns")}
									</DropdownMenuItem>
								)}
								{can("workspace.delete") && (
									<DropdownMenuItem onClick={() => setConfirmDisconnect(true)} variant='destructive'>
										<HugeiconsIcon
											aria-hidden='true'
											className='scale-110'
											icon={Delete02Icon}
											strokeWidth={1.75}
										/>
										{t("disconnect")}
									</DropdownMenuItem>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</div>
			</div>
			{group.status !== "live" && group.status !== "disconnecting" && (
				<DomainSetup controller={controller} group={group} />
			)}
			<RegistrationDetails controller={controller} group={group} />
			{group.status !== "live" && (
				<Button
					disabled={!can("workspace.write") || controller.pending}
					loading={controller.verify.isPending && controller.verify.variables?.domainId === group.lead.id}
					onClick={() => controller.verify.mutate({ domainId: group.lead.id })}
					size='sm'
					variant='outline'
				>
					{t(group.status === "disconnecting" ? "retry" : "checkNow")}
				</Button>
			)}
			<AlertDialog
				onOpenChange={(open) => {
					if (!controller.disconnect.isPending) {
						setConfirmDisconnect(open);
					}
				}}
				open={confirmDisconnect}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("disconnectTitle", { hostname: group.apex })}</AlertDialogTitle>
						<AlertDialogDescription>{t("disconnectNote")}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<Button
							disabled={controller.disconnect.isPending}
							onClick={() => setConfirmDisconnect(false)}
							variant='secondary'
						>
							{t("cancel")}
						</Button>
						<Button
							loading={controller.disconnect.isPending}
							onClick={() =>
								controller.disconnect.mutate(
									{ domainId: group.lead.id },
									{ onSettled: () => setConfirmDisconnect(false) }
								)
							}
							variant='destructive'
						>
							{t("disconnect")}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</section>
	);
};
