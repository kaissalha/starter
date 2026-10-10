"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { LazyMotion, domAnimation } from "motion/react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@starter/ui/components/button";
import { Skeleton } from "@starter/ui/components/skeleton";

import { CreateOrganizationForm } from "./create-organization-form";
import { InvitationList } from "./invitation-list";
import {
	useOnboardingController,
	type OnboardingController,
	type OnboardingInvitation,
} from "./use-onboarding-controller";

const OnboardingContent = ({ controller }: { controller: OnboardingController }) => {
	const t = useTranslations("onboarding");
	const tCommon = useTranslations("common");

	if (controller.isLoadingInvitations) {
		return (
			<div aria-busy className='space-y-5' role='status'>
				<span className='sr-only'>{t("loadingInvitations")}</span>
				<Skeleton className='h-4 w-3/4' />
				<div className='space-y-2'>
					<Skeleton className='h-4 w-28' />
					<Skeleton className='h-11 w-full' />
				</div>
				<Skeleton className='h-12 w-full' />
				<Skeleton className='h-4 w-2/3' />
			</div>
		);
	}

	if (controller.hasInvitationLoadError) {
		return (
			<div className='rounded-xl border border-border bg-muted/35 p-5 sm:p-6'>
				<div className='space-y-2'>
					<h2 className='text-base font-semibold'>{t("inviteTitle")}</h2>
					<p className='text-sm text-muted-foreground'>{t("messages.loadInvitations")}</p>
				</div>
				<div className='mt-5'>
					<Button className='w-full' onClick={() => controller.retryInvitationLoad()} size='lg' type='button'>
						{tCommon("retry")}
					</Button>
				</div>
			</div>
		);
	}

	if (controller.invitations.length > 0) {
		return (
			<InvitationList
				invitations={controller.invitations}
				isAcceptingInvitation={controller.isAcceptingInvitation}
				onAcceptInvitation={controller.handleAcceptInvitation}
				pendingInvitationId={controller.pendingInvitationId}
			/>
		);
	}

	return <CreateOrganizationForm isCreating={controller.isCreating} onCreate={controller.handleCreateOrganization} />;
};

type OnboardingClientProps = {
	initialInvitations: Array<OnboardingInvitation> | null;
	redirectPath: string;
	userEmail: string;
};

export const OnboardingClient = ({ initialInvitations, redirectPath, userEmail }: OnboardingClientProps) => {
	const t = useTranslations("onboarding");
	const tCommon = useTranslations("common");

	const controller = useOnboardingController({
		initialInvitations,
		redirectPath,
	});

	const hasInvitations = controller.invitations.length > 0;

	return (
		<main className='relative flex min-h-dvh flex-col bg-background'>
			<Button
				aria-label={tCommon("close")}
				className='absolute end-4 top-4 z-10 sm:end-5 sm:top-5'
				nativeButton={false}
				render={<Link aria-label={tCommon("close")} href='/' />}
				size='icon'
				variant='ghost'
			>
				<HugeiconsIcon aria-hidden className='scale-110' icon={Cancel01Icon} strokeWidth={1.75} />
			</Button>
			<section className='flex flex-1 items-center justify-center px-6 py-24 sm:px-10'>
				<div className='w-full max-w-[40rem]'>
					{hasInvitations && (
						<div className='mb-8 space-y-3'>
							<h1 className='text-2xl font-medium tracking-tight'>{t("inviteTitle")}</h1>
							<p className='text-sm leading-6 text-muted-foreground'>
								{t("inviteDescription", { email: userEmail })}
							</p>
						</div>
					)}
					<LazyMotion features={domAnimation} strict>
						<OnboardingContent controller={controller} />
					</LazyMotion>
				</div>
			</section>
		</main>
	);
};
