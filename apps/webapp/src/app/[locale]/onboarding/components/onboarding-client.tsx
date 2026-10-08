"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { LazyMotion, domAnimation } from "motion/react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@starter/ui/components/button";

import { OnboardingContent } from "./onboarding-content";
import { useOnboardingController, type OnboardingInvitation } from "./use-onboarding-controller";

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
