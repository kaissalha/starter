import Image from "next/image";

import { getTranslations } from "next-intl/server";

import { cn } from "@starter/ui/lib/utils";

const rows = [
	{ className: "animate-marquee", ids: ["baker", "florist", "barber", "ceramicist"] },
	{ className: "animate-marquee-reverse", ids: ["grocer", "tailor", "cafe", "mechanic"] },
] as const;

const owners = rows.flatMap((row) => row.ids);

const copies = [0, 1] as const;

type Owner = (typeof owners)[number];

const OwnerCard = ({ alt, className, id, trade }: { alt: string; className?: string; id: Owner; trade: string }) => {
	return (
		<div className={cn("relative aspect-3/4 overflow-hidden rounded-3xl bg-olive-200", className)}>
			<Image
				alt={alt}
				className='object-cover'
				fill
				sizes='(max-width: 640px) 40vw, (max-width: 1024px) 25vw, 12.5vw'
				src={`/images/home/owner-${id}.webp`}
			/>
			<p className='absolute inset-x-0 bottom-0 bg-linear-to-t from-olive-950/70 to-transparent p-4 pt-12 text-sm font-semibold text-white'>
				{trade}
			</p>
		</div>
	);
};

export const Owners = async () => {
	const t = await getTranslations("site.owners");

	const card = (id: Owner, className?: string) => (
		<OwnerCard alt={t(`items.${id}.alt`)} className={className} id={id} key={id} trade={t(`items.${id}.trade`)} />
	);

	return (
		<section className='px-6 py-32 sm:py-44 lg:px-10'>
			<div className='grid gap-6 lg:grid-cols-2 lg:gap-20'>
				<div>
					<h2 className='text-5xl leading-[0.98] font-semibold tracking-[-0.045em] text-balance sm:text-6xl rtl:leading-tight rtl:tracking-normal'>
						{t("title")}
					</h2>
				</div>
				<p className='max-w-md self-end text-lg leading-relaxed text-olive-600'>{t("description")}</p>
			</div>
			<div className='-mx-6 mt-14 flex flex-col gap-3 overflow-hidden motion-reduce:hidden sm:mt-20 lg:-mx-10'>
				{rows.map((row) => (
					<div className={cn("flex w-max gap-3 rtl:[--marquee-sign:-1]", row.className)} key={row.ids[0]}>
						{row.ids.map((id) => card(id, "w-40 sm:w-56 lg:w-80"))}
						{copies.map((copy) => (
							<div aria-hidden='true' className='flex gap-3' key={copy}>
								{row.ids.map((id) => card(id, "w-40 sm:w-56 lg:w-80"))}
							</div>
						))}
					</div>
				))}
			</div>
			<ul className='-mx-6 mt-14 hidden grid-cols-2 gap-3 motion-reduce:grid sm:grid-cols-4 lg:-mx-10 lg:grid-cols-8'>
				{owners.map((id, index) => (
					<li key={id}>{card(id, index % 2 === 1 ? "lg:mt-8" : undefined)}</li>
				))}
			</ul>
		</section>
	);
};
