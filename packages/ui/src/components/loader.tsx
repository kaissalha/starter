import type { ComponentProps } from "react";

import { cn } from "@starter/ui/lib/utils";

const BAR_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

export const Loader = ({ className, size = 16, ...props }: ComponentProps<"span"> & { size?: number }) => {
	return (
		<span
			aria-label='Loading'
			className={cn("inline-flex shrink-0 animate-spin text-current", className)}
			role='status'
			style={{ blockSize: size, inlineSize: size }}
			{...props}
		>
			<svg className='size-full' fill='none' viewBox='0 0 24 24'>
				{BAR_ANGLES.map((angle, index) => (
					<rect
						fill='currentColor'
						height='6'
						key={angle}
						opacity={(index + 1) / BAR_ANGLES.length}
						rx='1'
						transform={`rotate(${angle} 12 12)`}
						width='2'
						x='11'
						y='2'
					/>
				))}
			</svg>
		</span>
	);
};

Loader.displayName = "Loader";
