import Image from "next/image";

import { cn } from "@starter/ui/lib/utils";

type SiteFrameProps = {
	alt: string;
	className?: string;
	cta: string;
	headline: string;
	headlineClassName: string;
	image: string;
	name: string;
	navigation: string;
	ratio?: "square" | "wide";
};

export const SiteFrame = ({
	alt,
	className,
	cta,
	headline,
	headlineClassName,
	image,
	name,
	navigation,
	ratio = "square",
}: SiteFrameProps) => {
	return (
		<figure className={cn("overflow-hidden rounded-2xl bg-white text-olive-950 smooth-shadow-2xl", className)}>
			<div className='flex items-center justify-between gap-3 px-5 py-3.5 text-sm'>
				<span className='font-semibold'>{name}</span>
				<span className='truncate text-olive-600'>{navigation}</span>
			</div>
			<div
				className={cn(
					"relative isolate flex flex-col justify-center p-6 text-white",
					ratio === "wide" ? "aspect-[16/10] sm:p-10" : "aspect-square"
				)}
			>
				<Image
					alt={alt}
					className='-z-10 object-cover'
					fill
					sizes='(max-width: 640px) 90vw, 45vw'
					src={image}
				/>
				<div className='absolute inset-0 -z-10 bg-black/30' />
				<p className={cn("max-w-72 text-balance", headlineClassName)}>{headline}</p>
				<span className='mt-5 inline-flex w-fit rounded-full bg-white px-3.5 py-2 text-xs font-medium text-olive-950'>
					{cta}
				</span>
			</div>
		</figure>
	);
};
