"use client";

import type { BrandFoundationV1 } from "@starter/infinite-brand";
import { Badge } from "@starter/ui/components/badge";
import { Radio, RadioGroup } from "@starter/ui/components/radio-group";

export const BrandPalettePicker = ({
	label,
	onValueChange,
	optionLabel,
	presets,
	recommended,
	swatches,
	value,
}: {
	label: string;
	onValueChange: (id: string) => void;
	optionLabel: (index: number) => string;
	presets: ReadonlyArray<{ colors: BrandFoundationV1["colors"]; id: string }>;
	recommended?: { id: string; label: string } | null;
	swatches: ReadonlyArray<keyof BrandFoundationV1["colors"]>;
	value: string;
}) => (
	<RadioGroup aria-label={label} className='grid grid-cols-2' onValueChange={onValueChange} value={value}>
		{presets.map((preset, index) => (
			<label
				className='relative cursor-pointer rounded-xl bg-background p-4 outline outline-border transition-[outline-color,opacity] focus-within:outline-2 focus-within:outline-ring has-data-checked:outline-2 has-data-checked:outline-foreground has-data-unchecked:[@media(hover:hover)]:hover:opacity-80 motion-reduce:transition-none'
				key={preset.id}
			>
				<Radio value={preset.id} variant='card' />
				{recommended?.id === preset.id ? (
					<Badge className='absolute top-2 start-2 z-10' variant='dark'>
						{recommended.label}
					</Badge>
				) : null}
				<span className='sr-only'>{optionLabel(index)}</span>
				<span aria-hidden='true' className='flex justify-center'>
					{swatches.map((name) => (
						<span
							className='-ms-3 size-10 rounded-full first:ms-0'
							key={name}
							style={{ backgroundColor: preset.colors[name] }}
						/>
					))}
				</span>
			</label>
		))}
	</RadioGroup>
);
