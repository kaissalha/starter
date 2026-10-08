import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Button } from "@starter/ui/components/button";

export const Hero = async () => {
	const t = await getTranslations("site.hero");

	return (
		<section className='px-6 pt-24 pb-16 text-center sm:pt-32' id='hero'>
			<h1 className='mx-auto max-w-5xl text-[2.5rem] leading-[0.95] font-semibold tracking-[-0.04em] text-balance min-[30rem]:text-5xl md:text-6xl min-[62rem]:text-[5rem] rtl:leading-[1.2] rtl:tracking-normal'>
				{t("title")}
			</h1>
			<p className='mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-pretty text-olive-700 sm:text-xl'>
				{t("description")}
			</p>
			<div className='mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row'>
				<Button nativeButton={false} render={<Link href='/dashboard' />} size='xl'>
					{t("start")}
					<HugeiconsIcon
						aria-hidden='true'
						className='scale-110 rtl:-scale-x-110'
						data-icon='inline-end'
						icon={ArrowRight02Icon}
						strokeWidth={1.75}
					/>
				</Button>
				<Button nativeButton={false} render={<Link href='/login' />} size='xl' variant='outline'>
					{t("signIn")}
				</Button>
			</div>
		</section>
	);
};
