import {
	AiChat02Icon,
	ApiIcon,
	LanguageSkillIcon,
	Notification03Icon,
	UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getTranslations } from "next-intl/server";

const features = [
	{ icon: UserGroupIcon, id: "workspaces" },
	{ icon: AiChat02Icon, id: "assistant" },
	{ icon: Notification03Icon, id: "notifications" },
	{ icon: ApiIcon, id: "api" },
	{ icon: LanguageSkillIcon, id: "production" },
] as const;

export const Features = async () => {
	const t = await getTranslations("site.features");

	return (
		<section className='scroll-mt-28 px-6 py-32 sm:py-44 lg:px-10' id='features'>
			<h2 className='max-w-4xl text-5xl leading-[0.98] font-semibold tracking-[-0.045em] text-balance sm:text-7xl rtl:leading-tight rtl:tracking-normal'>
				{t("title")}
			</h2>
			<ul className='mt-20 grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
				{features.map(({ icon, id }) => (
					<li className='rounded-[28px] bg-white p-8 ring-1 ring-olive-950/6' key={id}>
						<span className='flex size-12 items-center justify-center rounded-2xl bg-olive-950 text-olive-50'>
							<HugeiconsIcon aria-hidden='true' className='scale-110' icon={icon} strokeWidth={1.75} />
						</span>
						<h3 className='mt-10 text-2xl font-semibold tracking-tight rtl:tracking-normal'>
							{t(`items.${id}.title`)}
						</h3>
						<p className='mt-3 text-base leading-relaxed text-olive-600'>{t(`items.${id}.description`)}</p>
					</li>
				))}
			</ul>
		</section>
	);
};
