import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Button } from "@starter/ui/components/button";
import { SilkCard } from "@starter/ui/components/silk-card";

export const CTA = async () => {
	const t = await getTranslations("site.cta");

	return (
		<section className='px-3 py-8 sm:px-6 sm:py-12' id='call-to-action'>
			<SilkCard palette='orange' seed={5} tilt={2}>
				<div className='flex min-h-[44rem] flex-col items-center justify-center px-6 py-28 text-center sm:min-h-[52rem] sm:py-36'>
					<h2 className='max-w-4xl text-[clamp(2.75rem,7vw,6rem)] leading-[0.95] font-semibold tracking-[-0.05em] text-balance rtl:leading-tight rtl:tracking-normal'>
						{t("title")}{" "}
						<span className='font-display font-normal tracking-[-0.02em] italic rtl:font-semibold rtl:not-italic'>
							{t("titleAccent")}
						</span>
					</h2>
					<p className='mt-8 max-w-md text-lg leading-relaxed text-white/80 sm:mt-10 sm:text-xl'>
						{t("description")}
					</p>
					<Button
						className='mt-12 border-white bg-white text-olive-950 hover:bg-olive-50 dark:bg-white dark:hover:bg-olive-50'
						nativeButton={false}
						render={<Link href='/dashboard/website' />}
						size='xl'
						variant='outline'
					>
						{t("start")}
						<HugeiconsIcon
							aria-hidden='true'
							className='scale-110 rtl:-scale-x-110'
							data-icon='inline-end'
							icon={ArrowRight02Icon}
							strokeWidth={1.75}
						/>
					</Button>
					<p className='mt-6 text-sm text-white/70'>{t("reassurance")}</p>
				</div>
			</SilkCard>
		</section>
	);
};
