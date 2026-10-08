import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getTranslations } from "next-intl/server";

import { Footer } from "@/app/[locale]/(site)/components/sections/footer";
import { Navbar } from "@/app/[locale]/(site)/components/sections/navbar";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
	const t = await getTranslations("notFound");

	return (
		<>
			<Navbar />
			<section className='flex flex-1 flex-col items-center justify-center py-16 mx-auto w-full max-w-2xl gap-6 px-6 md:max-w-3xl lg:max-w-7xl lg:px-10'>
				<h1 className='max-w-5xl text-center font-display text-8xl tracking-tight text-balance text-olive-950'>
					{t("title")}
				</h1>
				<p className='flex max-w-xl flex-col gap-4 text-center text-lg text-olive-700'>{t("description")}</p>
				<Link
					className='inline-flex items-center gap-2 text-sm font-medium text-olive-950 transition-opacity hover:opacity-70'
					href='/'
					prefetch={true}
				>
					{t("backHome")}
					<HugeiconsIcon
						aria-hidden='true'
						className='size-3.5 scale-110'
						icon={ArrowRight02Icon}
						strokeWidth={1.75}
					/>
				</Link>
			</section>
			<Footer />
		</>
	);
}
