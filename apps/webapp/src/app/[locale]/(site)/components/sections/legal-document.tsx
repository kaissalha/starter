import type { ReactNode } from "react";

import { getFormatter, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { legalVersion } from "@starter/server/contracts";
import { cn } from "@starter/ui/lib/utils";

import { Footer } from "./footer";
import { Navbar } from "./navbar";

type LegalDocumentProps = {
	children: ReactNode;
	contact: { body: string; email: string; heading: string };
	title: string;
};

export const LegalDocument = async ({ children, contact, title }: LegalDocumentProps) => {
	const [t, format] = await Promise.all([getTranslations("legal"), getFormatter()]);
	const date = format.dateTime(new Date(legalVersion), { dateStyle: "long", timeZone: "UTC" });

	return (
		<div className='bg-olive-50'>
			<Navbar />
			<main className='isolate overflow-clip'>
				<section className='py-16'>
					<div className='mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 sm:gap-16 md:max-w-3xl lg:max-w-7xl lg:px-10'>
						<div className='flex flex-col items-center gap-6'>
							<h1 className='max-w-5xl text-center font-display text-5xl tracking-tight text-olive-950 text-pretty sm:text-7xl'>
								{title}
							</h1>
							<p className='flex max-w-xl flex-col gap-4 text-center text-lg text-olive-700'>
								{t("lastUpdated", { date })}
							</p>
						</div>
						<div
							className={cn(
								"space-y-4 text-sm leading-7 text-olive-700",
								"[&_a]:font-semibold [&_a]:text-olive-950 [&_a]:underline [&_a]:underline-offset-4",
								"[&_h2]:text-base leading-8 [&_h2]:font-medium [&_h2]:text-olive-950 [&_h2]:not-first:mt-8",
								"[&_li]:ps-2 [&_ol]:list-decimal [&_ol]:ps-6",
								"[&_strong]:font-semibold [&_strong]:text-olive-950",
								"[&_ul]:list-[square] [&_ul]:ps-6 [&_ul]:marker:text-olive-400",
								"mx-auto max-w-2xl"
							)}
						>
							{children}

							<h2>{contact.heading}</h2>
							<p>
								{contact.body} <Link href={`mailto:${contact.email}`}>{contact.email}</Link>.
							</p>
							<p>
								{t("company")}, {t("address")}
							</p>
						</div>
					</div>
				</section>
			</main>
			<Footer />
		</div>
	);
};
