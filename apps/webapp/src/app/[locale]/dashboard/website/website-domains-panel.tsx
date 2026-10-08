"use client";

import { useState } from "react";

import {
	ArrowLeft01Icon,
	ArrowRight01Icon,
	Cancel01Icon,
	Edit02Icon,
	Globe02Icon,
	Link01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ORPCError } from "@orpc/client";
import { useTranslations } from "next-intl";

import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { Badge } from "@starter/ui/components/badge";
import { Button } from "@starter/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogTrigger,
	DialogPopup,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@starter/ui/components/dialog";
import { Input } from "@starter/ui/components/input";
import { ToggleGroup, ToggleGroupItem } from "@starter/ui/components/toggle-group";

import { useWebsiteDomainsController } from "./use-website-domains-controller";
import { CopyValue, WebsiteDomainCard } from "./website-domain-card";
import { WebsiteDomainCheckout } from "./website-domain-checkout";
import { WebsiteDomainDns } from "./website-domain-dns";
import { WebsiteDomainSearch } from "./website-domain-search";

type Controller = ReturnType<typeof useWebsiteDomainsController>;

const DomainConnect = ({ controller }: { controller: Controller }) => {
	const t = useTranslations("website.domains");
	const { can } = useOrganizationPermissions();
	const [hostname, setHostname] = useState("");
	const [method, setMethod] = useState<"records" | "nameservers">("records");

	return (
		<form
			className='space-y-4'
			onSubmit={(event) => {
				event.preventDefault();

				if (can("workspace.write") && !controller.pending && hostname.trim()) {
					controller.connect.mutate({ hostname, method });
				}
			}}
		>
			<label className='block space-y-2 text-sm font-medium'>
				<span>{t("hostname")}</span>
				<Input
					autoCapitalize='none'
					autoComplete='off'
					dir='ltr'
					maxLength={253}
					onChange={(event) => setHostname(event.target.value)}
					placeholder='example.com'
					required
					spellCheck={false}
					value={hostname}
				/>
			</label>
			<div className='space-y-2'>
				<p className='text-sm font-medium'>{t("method")}</p>
				<ToggleGroup
					aria-label={t("method")}
					onValueChange={([value]) => {
						if (value === "records" || value === "nameservers") {
							setMethod(value);
						}
					}}
					value={[method]}
					variant='outline'
				>
					<ToggleGroupItem value='records'>{t("methodRecords")}</ToggleGroupItem>
					<ToggleGroupItem value='nameservers'>{t("methodNameservers")}</ToggleGroupItem>
				</ToggleGroup>
			</div>
			{controller.connect.isError && (
				<p className='text-sm text-destructive' role='alert'>
					{t(
						controller.connect.error instanceof ORPCError && controller.connect.error.code === "CONFLICT"
							? "connectConflict"
							: "error"
					)}
				</p>
			)}
			<Button
				disabled={!can("workspace.write") || controller.pending || !hostname.trim()}
				loading={controller.connect.isPending}
				type='submit'
			>
				{t("connect")}
			</Button>
		</form>
	);
};

const SiteAddress = ({
	address,
	controller,
	subdomain,
}: {
	address: string;
	controller: Controller;
	subdomain: string;
}) => {
	const t = useTranslations("website.domains");
	const { can } = useOrganizationPermissions();
	const [draft, setDraft] = useState<string | null>(null);
	const suffix = address.slice(subdomain.length);

	if (draft === null) {
		return (
			<div className='flex items-center gap-2'>
				<a
					className='min-w-0 flex-1 truncate text-sm text-muted-foreground hover:underline'
					dir='ltr'
					href={`https://${address}`}
					rel='noreferrer'
					target='_blank'
				>
					{address}
				</a>
				<CopyValue value={`https://${address}`} />
				{can("workspace.write") && (
					<Button
						aria-label={t("editAddress")}
						onClick={() => setDraft(subdomain)}
						size='icon-sm'
						variant='ghost'
					>
						<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Edit02Icon} strokeWidth={1.75} />
					</Button>
				)}
			</div>
		);
	}

	return (
		<form
			className='space-y-2'
			onSubmit={(event) => {
				event.preventDefault();
				controller.subdomain.mutate(
					{ subdomain: draft.trim().toLowerCase() },
					{ onSuccess: () => setDraft(null) }
				);
			}}
		>
			<div className='flex items-center gap-2' dir='ltr'>
				<Input
					aria-label={t("siteAddress")}
					autoCapitalize='none'
					maxLength={50}
					onChange={(event) => setDraft(event.target.value)}
					spellCheck={false}
					value={draft}
				/>
				<span className='shrink-0 text-sm text-muted-foreground'>{suffix}</span>
			</div>
			{controller.subdomain.isError && (
				<p className='text-sm text-destructive' role='alert'>
					{t(
						controller.subdomain.error instanceof ORPCError &&
							controller.subdomain.error.code === "CONFLICT"
							? "addressTaken"
							: "addressInvalid"
					)}
				</p>
			)}
			<div className='flex gap-2'>
				<Button loading={controller.subdomain.isPending} size='sm' type='submit'>
					{t("saveAddress")}
				</Button>
				<Button onClick={() => setDraft(null)} size='sm' type='button' variant='ghost'>
					{t("cancel")}
				</Button>
			</div>
		</form>
	);
};

const DomainOptions = ({ controller, publicUrl }: { controller: Controller; publicUrl?: string }) => {
	const t = useTranslations("website.domains");
	const data = controller.query.data;

	return (
		<div className='space-y-3'>
			{(["search", "connect"] as const).map((view) => (
				<Button
					className='w-full'
					key={view}
					onClick={() => controller.setView({ name: view })}
					size='option-lg'
					variant='secondary'
				>
					<HugeiconsIcon
						aria-hidden='true'
						className='scale-110'
						icon={view === "search" ? Globe02Icon : Link01Icon}
						strokeWidth={1.75}
					/>
					<span className='min-w-0 flex-1 space-y-1'>
						<span className='block'>{t(view === "search" ? "findTitle" : "connectTitle")}</span>
						<span className='block text-sm font-normal text-muted-foreground'>
							{t(view === "search" ? "findDescription" : "connectSummary")}
						</span>
					</span>
					<HugeiconsIcon
						aria-hidden='true'
						className='scale-110'
						icon={ArrowRight01Icon}
						strokeWidth={1.75}
					/>
				</Button>
			))}
			{(data?.address || publicUrl) && (
				<section className='space-y-2 rounded-xl border p-5'>
					<h3 className='text-sm font-medium'>{t("siteAddress")}</h3>
					{data?.address && data.subdomain ? (
						<SiteAddress
							address={data.address}
							controller={controller}
							key={data.subdomain}
							subdomain={data.subdomain}
						/>
					) : (
						<p className='break-all text-sm text-muted-foreground' dir='ltr'>
							{publicUrl}
						</p>
					)}
				</section>
			)}
		</div>
	);
};

const DomainOverview = ({ controller, publicUrl }: { controller: Controller; publicUrl?: string }) => {
	const t = useTranslations("website.domains");

	return (
		<>
			<DomainOptions controller={controller} publicUrl={publicUrl} />
			{controller.query.isPending && <p role='status'>{t("loading")}</p>}
			{controller.query.isError && (
				<div className='space-y-3'>
					<p className='text-sm text-destructive' role='alert'>
						{t("loadError")}
					</p>
					<Button onClick={() => controller.query.refetch()} variant='outline'>
						{t("retry")}
					</Button>
				</div>
			)}
			{controller.pendingRegistrations.map((registration) => (
				<section
					className='flex items-center justify-between gap-3 rounded-xl border p-4'
					key={registration.id}
				>
					<span className='break-all font-medium' dir='ltr'>
						{registration.domain}
					</span>
					<Badge variant={registration.status === "registering" ? "suboptimal" : "critical"}>
						{t(`registrationStatus.${registration.status}`)}
					</Badge>
				</section>
			))}
			{controller.groups.map((group) => (
				<WebsiteDomainCard controller={controller} group={group} key={group.key} />
			))}
		</>
	);
};

const viewHeading = (view: Controller["view"]) =>
	(
		({
			checkout: { description: null, title: "checkoutTitle" },
			connect: { description: "connectDescription", title: "connectTitle" },
			dns: { description: "dnsDescription", title: "dnsTitle" },
			overview: { description: "description", title: "title" },
			search: { description: null, title: "findTitle" },
		}) as const
	)[view.name];

export const WebsiteDomainsContent = ({ embedded, publicUrl }: { embedded?: boolean; publicUrl?: string }) => {
	const t = useTranslations("website.domains");
	const controller = useWebsiteDomainsController();
	const { view } = controller;
	const heading = viewHeading(view);
	const title = view.name === "dns" ? t(heading.title, { hostname: view.domain.hostname }) : t(heading.title);

	return (
		<div>
			<DialogHeader className='flex-row items-start text-start' variant='spacious'>
				{view.name !== "overview" && (
					<Button
						aria-label={t("back")}
						className='-ms-2 mt-0.5 shrink-0'
						onClick={() => controller.setView({ name: "back" })}
						size='icon-sm'
						variant='ghost'
					>
						<HugeiconsIcon
							aria-hidden='true'
							className='scale-110'
							icon={ArrowLeft01Icon}
							strokeWidth={1.75}
						/>
					</Button>
				)}
				<div className='min-w-0 space-y-2'>
					{embedded ? (
						<>
							<h2 className='text-xl font-semibold'>{title}</h2>
							{heading.description && (
								<p className='text-sm text-muted-foreground'>{t(heading.description)}</p>
							)}
						</>
					) : (
						<>
							<DialogTitle size='default'>{title}</DialogTitle>
							{heading.description && <DialogDescription>{t(heading.description)}</DialogDescription>}
						</>
					)}
				</div>
			</DialogHeader>
			<div className='space-y-6 px-6 pb-6 sm:px-8 sm:pb-8'>
				{view.name === "search" && (
					<WebsiteDomainSearch
						controller={controller}
						initialQuery={controller.query.data?.businessName ?? ""}
						key={controller.query.data?.businessName ?? ""}
					/>
				)}
				{view.name === "connect" && <DomainConnect controller={controller} />}
				{view.name === "checkout" && (
					<WebsiteDomainCheckout controller={controller} key={view.offer.domain} offer={view.offer} />
				)}
				{view.name === "dns" && <WebsiteDomainDns domainId={view.domain.id} />}
				{view.name === "overview" && <DomainOverview controller={controller} publicUrl={publicUrl} />}
				{view.name === "overview" && controller.error && (
					<p className='text-sm text-destructive' role='alert'>
						{t("error")}
					</p>
				)}
			</div>
		</div>
	);
};

export const WebsiteDomainsPanel = ({ publicUrl }: { publicUrl?: string }) => {
	const t = useTranslations("website.domains");

	return (
		<Dialog>
			<DialogTrigger render={<Button className='w-full justify-start' variant='outline' />}>
				<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Globe02Icon} strokeWidth={1.75} />
				<span className='flex-1 text-start'>{t("title")}</span>
				<HugeiconsIcon aria-hidden='true' className='scale-110' icon={ArrowRight01Icon} strokeWidth={1.75} />
			</DialogTrigger>
			<DialogPopup
				className='max-h-[calc(80dvh-2rem)] overflow-y-auto'
				padding='none'
				showCloseButton={false}
				size='xl'
			>
				<DialogClose
					render={
						<Button
							aria-label={t("close")}
							className='absolute inset-e-4 top-5'
							size='icon-sm'
							variant='ghost'
						/>
					}
				>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Cancel01Icon} strokeWidth={1.75} />
				</DialogClose>
				<WebsiteDomainsContent publicUrl={publicUrl} />
			</DialogPopup>
		</Dialog>
	);
};
