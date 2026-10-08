"use client";

import { Tick02Icon, Shield01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";

import { Logo } from "@/components/logo";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { Alert, AlertDescription } from "@starter/ui/components/alert";
import { Button } from "@starter/ui/components/button";
import { Card, CardDescription, CardFooter, CardHeader, CardPanel, CardTitle } from "@starter/ui/components/card";
import { Skeleton } from "@starter/ui/components/skeleton";

import { useOauthConsent } from "./use-oauth-consent";

type ConsentPageClientProps = {
	clientId?: string;
	redirectHost?: string;
	requestedScopes: Array<string>;
};

export const ConsentPageClient = ({ clientId, redirectHost, requestedScopes }: ConsentPageClientProps) => {
	const t = useTranslations("account.oauthConsent");
	const { data: organization } = authClient.useActiveOrganization();
	const { approve, client, deny, error, isPending, isSubmitting } = useOauthConsent({ clientId });

	const scopeLabels = new Map([
		["openid", t("scopes.openid")],
		["profile", t("scopes.profile")],
		["email", t("scopes.email")],
		["offline_access", t("scopes.offlineAccess")],
		["mcp", t("scopes.mcp")],
	]);

	return (
		<main className='relative flex min-h-dvh items-center justify-center bg-background px-4 py-20 sm:px-6'>
			<Link
				aria-label={t("homeLink")}
				className='absolute start-4 top-4 flex size-11 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:start-6 sm:top-6'
				href='/'
				prefetch={true}
			>
				<Logo className='size-8 text-foreground' />
			</Link>

			<Card className='w-full max-w-lg overflow-hidden' corners='rounded'>
				<CardHeader>
					<div className='flex size-11 items-center justify-center rounded-xl bg-muted text-foreground'>
						<HugeiconsIcon
							aria-hidden
							className='size-5 scale-110'
							icon={Shield01Icon}
							strokeWidth={1.75}
						/>
					</div>
					<div className='space-y-2'>
						<CardTitle size='lg'>{t("title")}</CardTitle>
						{isPending ? (
							<div className='space-y-2'>
								<Skeleton className='h-5 w-48' />
								<Skeleton className='h-4 w-full' />
							</div>
						) : (
							<CardDescription>
								{t("description", {
									clientName: client?.client_name || t("unknownClient"),
								})}
							</CardDescription>
						)}
					</div>
				</CardHeader>

				<CardPanel spacing='default'>
					<div className='space-y-3'>
						<p className='text-sm font-medium text-foreground'>{t("permissionsTitle")}</p>
						<ul className='space-y-3'>
							{requestedScopes.map((scope) => (
								<li className='flex items-start gap-3 text-sm text-muted-foreground' key={scope}>
									<span className='mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-foreground'>
										<HugeiconsIcon
											aria-hidden
											className='size-3 scale-110'
											icon={Tick02Icon}
											strokeWidth={1.75}
										/>
									</span>
									<span className='leading-5'>{scopeLabels.get(scope) ?? scope}</span>
								</li>
							))}
						</ul>
					</div>

					<dl className='space-y-2 text-sm'>
						{organization?.name && (
							<div className='flex items-baseline justify-between gap-4'>
								<dt className='text-muted-foreground'>{t("workspaceLabel")}</dt>
								<dd className='truncate font-medium text-foreground' dir='auto'>
									{organization.name}
								</dd>
							</div>
						)}
						{redirectHost && (
							<div className='flex items-baseline justify-between gap-4'>
								<dt className='text-muted-foreground'>{t("destinationLabel")}</dt>
								<dd className='truncate font-mono font-medium text-foreground' dir='ltr'>
									{redirectHost}
								</dd>
							</div>
						)}
					</dl>

					<p className='text-xs leading-5 text-muted-foreground'>{t("workspaceNotice")}</p>

					{(!clientId || error) && (
						<Alert aria-live='assertive' variant='error'>
							<AlertDescription>{t("error")}</AlertDescription>
						</Alert>
					)}
				</CardPanel>

				<CardFooter className='flex-col-reverse sm:flex-row sm:justify-end'>
					<Button
						className='w-full sm:w-auto'
						disabled={isSubmitting}
						onClick={deny}
						size='lg'
						type='button'
						variant='outline'
					>
						{t("deny")}
					</Button>
					<Button
						className='w-full sm:w-auto'
						disabled={!clientId || Boolean(error) || isPending || isSubmitting}
						loading={isSubmitting}
						onClick={approve}
						size='lg'
						type='button'
					>
						{t("approve")}
					</Button>
				</CardFooter>
			</Card>
		</main>
	);
};
