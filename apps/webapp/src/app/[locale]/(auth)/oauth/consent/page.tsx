import { Suspense } from "react";

import type { Metadata } from "next";

import { getTranslations } from "next-intl/server";

import { Card, CardHeader, CardPanel } from "@starter/ui/components/card";
import { Skeleton } from "@starter/ui/components/skeleton";

import { ConsentPageClient } from "./consent-page-client";

export const generateMetadata = async (): Promise<Metadata> => {
	const t = await getTranslations("account.oauthConsent");

	return {
		robots: { follow: false, index: false },
		title: t("pageTitle"),
	};
};

const ConsentPageContent = async ({
	searchParams,
}: {
	searchParams: Promise<{ client_id?: string; redirect_uri?: string; scope?: string }>;
}) => {
	const { client_id: clientId, redirect_uri: redirectUri = "", scope = "" } = await searchParams;
	const redirectUrl = URL.parse(redirectUri);

	return (
		<ConsentPageClient
			clientId={clientId}
			redirectHost={redirectUrl ? redirectUrl.host || redirectUrl.protocol : undefined}
			requestedScopes={scope.split(" ").filter(Boolean)}
		/>
	);
};

export default function ConsentPage({
	searchParams,
}: {
	searchParams: Promise<{ client_id?: string; redirect_uri?: string; scope?: string }>;
}) {
	return (
		<Suspense
			fallback={
				<main
					aria-busy='true'
					className='flex min-h-dvh items-center justify-center bg-background px-4 py-20 sm:px-6'
				>
					<Card className='w-full max-w-lg overflow-hidden' corners='rounded'>
						<CardHeader>
							<Skeleton className='size-11' corners='rounded' />
							<div className='space-y-2'>
								<Skeleton className='h-7 w-56 max-w-full' />
								<Skeleton className='h-5 w-72 max-w-full' />
							</div>
						</CardHeader>
						<CardPanel spacing='default'>
							<Skeleton className='h-5 w-40' />
							<Skeleton className='h-5 w-full' />
							<Skeleton className='h-5 w-5/6' />
							<Skeleton className='h-5 w-4/6' />
						</CardPanel>
					</Card>
				</main>
			}
		>
			<ConsentPageContent searchParams={searchParams} />
		</Suspense>
	);
}
