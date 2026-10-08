import { FavouriteIcon, Search01Icon, StarIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getTranslations } from "next-intl/server";

import { ShaderIndex } from "@starter/ui/components/shader-index";

const items = [
	{ icon: Search01Icon, id: "found", palette: "blue" },
	{ icon: StarIcon, id: "chosen", palette: "purple" },
	{ icon: FavouriteIcon, id: "remembered", palette: "red" },
] as const;

export const Facts = async () => {
	const t = await getTranslations("site.facts");

	return (
		<section className='px-6 py-20 sm:py-28 lg:px-10'>
			<ShaderIndex
				heading={
					<h2 className='max-w-3xl text-5xl leading-[0.98] font-semibold tracking-[-0.045em] text-balance sm:text-7xl rtl:leading-tight rtl:tracking-normal'>
						{t("title")}
					</h2>
				}
				items={items.map(({ icon, id, palette }) => ({
					description: t(`items.${id}.label`),
					icon: <HugeiconsIcon className='scale-110' icon={icon} strokeWidth={1.75} />,
					id,
					palette,
					title: t(`items.${id}.value`),
				}))}
			/>
		</section>
	);
};
