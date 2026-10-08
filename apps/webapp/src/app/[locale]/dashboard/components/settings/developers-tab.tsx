"use client";

import { useState, type ReactNode } from "react";

import { Tick02Icon, Copy01Icon, Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MorphIcon } from "morphicons/react";
import { useFormatter, useTranslations } from "next-intl";
import { z } from "zod";

import { useAuthSession } from "@/components/auth/auth-session-context";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { authClient } from "@/lib/auth-client";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@starter/ui/components/alert-dialog";
import { Button } from "@starter/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@starter/ui/components/dialog";
import { Input } from "@starter/ui/components/input";
import { Label } from "@starter/ui/components/label";
import { Skeleton } from "@starter/ui/components/skeleton";
import { toast } from "@starter/ui/components/toaster";
import { getBaseURL } from "@starter/utils";

import { SettingsCard } from "./settings-card";

type MutableReference<Value> = { value: Value };

type ApiKeySummary = {
	createdAt: Date | string;
	expiresAt: Date | string | null;
	id: string;
	lastRequest: Date | string | null;
	name: string | null;
	start: string | null;
};

type ApiKeyMetadata = { organizationId?: string } | null | string;

const apiKeyMetadataSchema = z.compile(z.looseObject({ organizationId: z.string().optional() }));

const readApiKeyOrganizationId = (metadata: ApiKeyMetadata) => {
	if (metadata instanceof Object) {
		return metadata.organizationId;
	}

	try {
		const parsed = apiKeyMetadataSchema.safeParse(JSON.parse(metadata ?? "null"));

		return parsed.success ? parsed.data.organizationId : undefined;
	} catch {
		return undefined;
	}
};

const CopyButton = ({ label, value }: { label: string; value: string }) => {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			setCopied(false);
		}
	};

	return (
		<Button aria-label={label} onClick={handleCopy} size='icon-sm' variant='ghost'>
			<MorphIcon
				className='scale-110'
				icon={copied ? Tick02Icon : Copy01Icon}
				reducedMotion='user'
				strokeWidth={1.75}
			/>
		</Button>
	);
};

const EndpointRow = ({ copyLabel, label, value }: { copyLabel: string; label: string; value: string }) => (
	<div className='flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3'>
		<div className='flex min-w-0 flex-col gap-0.5'>
			<p className='text-sm font-medium'>{label}</p>
			<p className='truncate font-mono text-xs text-muted-foreground' dir='ltr'>
				{value}
			</p>
		</div>
		<CopyButton label={copyLabel} value={value} />
	</div>
);

const ApiKeyDialogs = ({
	createdKey,
	isCreateOpen,
	isCreating,
	isRevoking,
	keyToRevoke,
	newKeyName,
	onCloseCreate,
	onCreate,
	onKeyNameChange,
	onRevoke,
	onRevokeChange,
}: {
	createdKey: string | null;
	isCreateOpen: boolean;
	isCreating: boolean;
	isRevoking: boolean;
	keyToRevoke: ApiKeySummary | null;
	newKeyName: string;
	onCloseCreate: () => void;
	onCreate: () => void;
	onKeyNameChange: (value: string) => void;
	onRevoke: () => void;
	onRevokeChange: (key: ApiKeySummary | null) => void;
}) => {
	const t = useTranslations("settings.developers");
	const tCommon = useTranslations("common");

	return (
		<>
			<Dialog onOpenChange={(open) => !open && onCloseCreate()} open={isCreateOpen}>
				<DialogContent closeLabel={tCommon("close")}>
					{createdKey ? (
						<>
							<DialogHeader>
								<DialogTitle>{t("apiKeys.createdTitle")}</DialogTitle>
								<DialogDescription>{t("apiKeys.createdDescription")}</DialogDescription>
							</DialogHeader>
							<div className='flex min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2'>
								<code className='min-w-0 flex-1 break-all font-mono text-xs' dir='ltr'>
									{createdKey}
								</code>
								<CopyButton label={t("copy")} value={createdKey} />
							</div>
							<DialogFooter>
								<Button onClick={onCloseCreate}>{t("apiKeys.done")}</Button>
							</DialogFooter>
						</>
					) : (
						<>
							<DialogHeader>
								<DialogTitle>{t("apiKeys.createTitle")}</DialogTitle>
								<DialogDescription>{t("apiKeys.createDescription")}</DialogDescription>
							</DialogHeader>
							<div className='flex flex-col gap-2'>
								<Label htmlFor='api-key-name'>{t("apiKeys.name")}</Label>
								<Input
									autoFocus
									id='api-key-name'
									onChange={(event) => onKeyNameChange(event.target.value)}
									placeholder={t("apiKeys.namePlaceholder")}
									value={newKeyName}
								/>
							</div>
							<DialogFooter>
								<Button className='flex-1' onClick={onCloseCreate} size='lg' variant='secondary'>
									{t("apiKeys.cancel")}
								</Button>
								<Button
									className='flex-1'
									disabled={isCreating || !newKeyName.trim()}
									onClick={onCreate}
									size='lg'
								>
									{t("apiKeys.create")}
								</Button>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>
			<AlertDialog onOpenChange={(open) => !open && onRevokeChange(null)} open={!!keyToRevoke}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("apiKeys.revokeTitle")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("apiKeys.revokeDescription", { name: keyToRevoke?.name || t("apiKeys.unnamed") })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<Button onClick={() => onRevokeChange(null)} variant='outline'>
							{t("apiKeys.cancel")}
						</Button>
						<Button disabled={isRevoking} onClick={onRevoke} variant='destructive'>
							{t("apiKeys.revoke")}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
};

export const DevelopersTab = () => {
	const format = useFormatter();
	const { can } = useOrganizationPermissions();
	const t = useTranslations("settings.developers");
	const queryClient = useQueryClient();
	const { data: session } = useAuthSession();
	const organizationId = session?.session.activeOrganizationId;
	const origin = getBaseURL().origin;

	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [newKeyName, setNewKeyName] = useState("");
	const [createdKey, setCreatedKey] = useState<string | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [keyToRevoke, setKeyToRevoke] = useState<ApiKeySummary | null>(null);
	const [isRevoking, setIsRevoking] = useState(false);

	const {
		data: apiKeys,
		isError,
		isPending,
		refetch,
	} = useQuery({
		enabled: !!organizationId,
		queryFn: async () => {
			const { data, error } = await authClient.apiKey.list();

			if (error) {
				throw error;
			}

			return (data?.apiKeys ?? []).flatMap<ApiKeySummary>((key) => {
				const { createdAt, expiresAt, id, lastRequest, name, start } = key;

				return readApiKeyOrganizationId(key.metadata) === organizationId
					? [{ createdAt, expiresAt, id, lastRequest, name, start }]
					: [];
			});
		},
		queryKey: ["api-keys", organizationId],
	});

	const mcpConfigSnippet = JSON.stringify(
		{ mcpServers: { starter: { type: "http", url: `${origin}/api/mcp` } } },
		null,
		2
	);

	const closeCreateDialog = () => {
		setIsCreateOpen(false);
		setNewKeyName("");
		setCreatedKey(null);
	};

	const handleCreate = async () => {
		if (!can("workspace.write") || !organizationId || !newKeyName.trim()) {
			return;
		}

		setIsCreating(true);

		try {
			const { data, error } = await authClient.apiKey.create({
				metadata: { organizationId },
				name: newKeyName.trim(),
			});

			if (error || !data) {
				toast.error(t("apiKeys.createError"));

				return;
			}

			setCreatedKey(data.key);
			await queryClient.invalidateQueries({ queryKey: ["api-keys", organizationId] });
		} catch {
			toast.error(t("apiKeys.createError"));
		} finally {
			setIsCreating(false);
		}
	};

	const handleRevoke = async () => {
		if (!keyToRevoke) {
			return;
		}

		setIsRevoking(true);

		try {
			const { error } = await authClient.apiKey.delete({ keyId: keyToRevoke.id });

			if (error) {
				toast.error(t("apiKeys.revokeError"));

				return;
			}

			toast.success(t("apiKeys.revoked"));
			setKeyToRevoke(null);
			await queryClient.invalidateQueries({ queryKey: ["api-keys", organizationId] });
		} catch {
			toast.error(t("apiKeys.revokeError"));
		} finally {
			setIsRevoking(false);
		}
	};

	if (!session) {
		return (
			<div className='flex max-w-3xl flex-col gap-6'>
				<div className='rounded-lg border border-border bg-card p-6'>
					<Skeleton className='h-5 w-48' />
					<Skeleton className='mt-2 h-4 w-72' />
				</div>
			</div>
		);
	}

	const apiKeysContentReference: MutableReference<ReactNode | undefined> = { value: undefined };

	if (isPending) {
		apiKeysContentReference.value = (
			<div className='flex flex-col gap-2'>
				<Skeleton className='h-14 w-full' />
				<Skeleton className='h-14 w-full' />
			</div>
		);
	} else if (isError) {
		apiKeysContentReference.value = (
			<div className='rounded-lg border border-border p-4 text-sm' role='alert'>
				<p className='text-muted-foreground'>{t("apiKeys.loadError")}</p>
				<Button className='mt-3' onClick={() => refetch()} size='sm' variant='outline'>
					{t("apiKeys.retry")}
				</Button>
			</div>
		);
	} else if (apiKeys?.length) {
		apiKeysContentReference.value = (
			<div className='flex flex-col gap-2'>
				{apiKeys.map((key) => (
					<div
						className='flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3'
						key={key.id}
					>
						<div className='flex min-w-0 flex-col gap-0.5'>
							<p className='truncate text-sm font-medium'>{key.name || t("apiKeys.unnamed")}</p>
							<p className='font-mono text-xs text-muted-foreground'>
								{key.start ? `${key.start}…` : "•••"}
								<span className='ms-2 font-sans'>
									{t("apiKeys.createdOn", { date: format.dateTime(new Date(key.createdAt)) })}
									{key.expiresAt
										? ` · ${t("apiKeys.expiresOn", { date: format.dateTime(new Date(key.expiresAt)) })}`
										: ""}
								</span>
							</p>
						</div>
						<Button onClick={() => setKeyToRevoke(key)} size='sm' variant='outline'>
							{t("apiKeys.revoke")}
						</Button>
					</div>
				))}
			</div>
		);
	} else {
		apiKeysContentReference.value = (
			<p className='rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground'>
				{t("apiKeys.empty")}
			</p>
		);
	}

	return (
		<div className='flex max-w-3xl flex-col gap-6'>
			<SettingsCard
				action={
					can("workspace.write") && (
						<Button disabled={!organizationId} onClick={() => setIsCreateOpen(true)} size='sm'>
							<HugeiconsIcon
								aria-hidden='true'
								className='scale-110'
								icon={Add01Icon}
								strokeWidth={1.75}
							/>
							{t("apiKeys.create")}
						</Button>
					)
				}
				description={t("apiKeys.description")}
				title={t("apiKeys.title")}
			>
				{apiKeysContentReference.value}
			</SettingsCard>

			<SettingsCard description={t("endpoints.description")} title={t("endpoints.title")}>
				<div className='flex flex-col gap-2'>
					<EndpointRow copyLabel={t("copy")} label={t("endpoints.restBase")} value={`${origin}/api/v1`} />
					<EndpointRow copyLabel={t("copy")} label={t("endpoints.docs")} value={`${origin}/api/v1/docs`} />
					<EndpointRow
						copyLabel={t("copy")}
						label={t("endpoints.openapi")}
						value={`${origin}/api/v1/openapi.json`}
					/>
					<EndpointRow copyLabel={t("copy")} label={t("endpoints.mcp")} value={`${origin}/api/mcp`} />
				</div>

				<div className='mt-4 flex flex-col gap-2'>
					<div className='flex items-center justify-between'>
						<Label>{t("endpoints.mcpConfig")}</Label>
						<CopyButton label={t("copy")} value={mcpConfigSnippet} />
					</div>
					<pre
						className='overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 font-mono text-xs'
						dir='ltr'
					>
						{mcpConfigSnippet}
					</pre>
				</div>
			</SettingsCard>

			<ApiKeyDialogs
				createdKey={createdKey}
				isCreateOpen={can("workspace.write") && isCreateOpen}
				isCreating={isCreating}
				isRevoking={isRevoking}
				keyToRevoke={keyToRevoke}
				newKeyName={newKeyName}
				onCloseCreate={closeCreateDialog}
				onCreate={handleCreate}
				onKeyNameChange={setNewKeyName}
				onRevoke={handleRevoke}
				onRevokeChange={setKeyToRevoke}
			/>
		</div>
	);
};
