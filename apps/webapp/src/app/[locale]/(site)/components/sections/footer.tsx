import type { ComponentProps } from "react";

import { getTranslations } from "next-intl/server";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { Logo } from "@/components/logo";
import { Link } from "@/i18n/navigation";
import { LiquidHeadline } from "@starter/ui/components/liquid-headline";
import { cn } from "@starter/ui/lib/utils";

const footerSections = [
	{
		id: "product",
		links: [
			{ href: "/#platform", id: "platform" },
			{ href: "/#links", id: "links" },
			{ href: "/#how-it-works", id: "howItWorks" },
			{ href: "/templates", id: "templates" },
		],
	},
	{
		id: "help",
		links: [
			{ href: "/#faqs", id: "faqs" },
			{ href: "/privacy", id: "privacy" },
			{ href: "/terms", id: "terms" },
		],
	},
	{
		id: "app",
		links: [
			{ href: "/login", id: "signIn" },
			{ href: "/dashboard", id: "dashboard" },
		],
	},
] as const;

const linkClassName =
	"rounded-sm text-olive-700 hover:text-olive-950 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-olive-700";

export const Footer = async ({ className, ...props }: ComponentProps<"footer">) => {
	const t = await getTranslations("site.footer");
	const brand = await getTranslations("site");

	return (
		<footer className={cn("relative overflow-hidden bg-white pt-32 text-olive-950", className)} {...props}>
			<div className='grid gap-12 px-6 lg:grid-cols-[16rem_1fr_22rem] lg:gap-20 lg:px-10'>
				<Link
					aria-label={t("links.home")}
					className='flex flex-col gap-4 self-start rounded-sm focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-olive-700'
					href='/'
				>
					<Logo className='size-16 text-brand-green-ink' />
					<span>
						<span className='block text-2xl font-semibold text-brand-green-ink'>{brand("brand")}</span>
						<span className='block max-w-40 text-base leading-snug text-olive-600'>{t("tagline")}</span>
					</span>
				</Link>

				<div className='grid grid-cols-2 gap-x-6 gap-y-12 text-lg sm:grid-cols-3'>
					{footerSections.map((section) => (
						<div key={section.id}>
							<h3 className='text-base font-medium text-olive-500'>{t(`sections.${section.id}`)}</h3>
							<ul className='mt-5 flex flex-col gap-4'>
								{section.links.map((link) => (
									<li key={link.id}>
										<Link className={linkClassName} href={link.href}>
											{t(`links.${link.id}`)}
										</Link>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>

				<div className='flex flex-col items-start gap-6'>
					<p className='max-w-sm border-s border-olive-300 ps-5 text-lg leading-relaxed text-pretty text-olive-700'>
						{t("note")}
					</p>
					<LocaleSwitcher />
				</div>
			</div>

			<div className='mt-32 -mb-[1.4vw] px-2 text-center'>
				<div>
					<LiquidHeadline aria-hidden='true' as='span' palette='green' seed={4} size='wordmark'>
						<span data-liquid-text>{brand("brand")}</span>
					</LiquidHeadline>
				</div>
			</div>
		</footer>
	);
};
