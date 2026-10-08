"use client";

import type { ComponentProps } from "react";

import { useTranslations } from "next-intl";

import { Accordion, AccordionItem, AccordionPanel, AccordionTrigger } from "@starter/ui/components/accordion";
import { cn } from "@starter/ui/lib/utils";

const faqIds = ["included", "customize", "deploy", "production"] as const;

export const Faqs = ({ className, ...props }: ComponentProps<"section">) => {
	const t = useTranslations("site.faqs");

	return (
		<section
			className={cn(
				"grid scroll-mt-28 grid-cols-1 gap-12 px-6 py-32 lg:grid-cols-2 lg:gap-20 lg:px-10 lg:py-44",
				className
			)}
			id='faqs'
			{...props}
		>
			<div>
				<h2 className='max-w-2xl text-5xl leading-[0.98] font-semibold tracking-[-0.045em] rtl:leading-tight rtl:tracking-normal text-balance text-olive-950 sm:text-7xl lg:text-8xl'>
					{t("title")}
				</h2>
			</div>
			<Accordion multiple={false}>
				{faqIds.map((id) => (
					<AccordionItem key={id} value={id}>
						<AccordionTrigger className='w-full' size='lg'>
							{t(`items.${id}.question`)}
						</AccordionTrigger>
						<AccordionPanel className='max-w-xl' size='lg'>
							{t(`items.${id}.answer`)}
						</AccordionPanel>
					</AccordionItem>
				))}
			</Accordion>
		</section>
	);
};
