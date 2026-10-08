import type { ReactNode } from "react";

import { brandFontPairings, getBrandFont, type BrandFontPairingId } from "@starter/infinite-brand";
import { Radio } from "@starter/ui/components/radio-group";

export const EditorFontPairingOption = ({
	children,
	pairingId,
}: {
	children?: ReactNode;
	pairingId: BrandFontPairingId;
}) => {
	const pairing = brandFontPairings[pairingId];
	const heading = getBrandFont({ fontId: pairing.heading.default.fontId });
	const body = getBrandFont({ fontId: pairing.body.default.fontId });

	return (
		<label className='relative cursor-pointer rounded-xl bg-muted/40 p-4 outline-2 outline-transparent transition-[outline-color,opacity] focus-within:outline-ring has-data-checked:outline-foreground has-data-unchecked:[@media(hover:hover)]:hover:opacity-80 motion-reduce:transition-none'>
			<Radio value={pairingId} variant='card' />
			{children}
			<span
				className='block truncate text-lg font-semibold'
				style={{ fontFamily: heading ? `${heading.family}, ${heading.fallback}` : undefined }}
			>
				{heading?.family.replace(" Variable", "")}
			</span>
			<span
				className='mt-1 block truncate text-sm text-muted-foreground'
				style={{ fontFamily: body ? `${body.family}, ${body.fallback}` : undefined }}
			>
				{body?.family.replace(" Variable", "")}
			</span>
		</label>
	);
};
