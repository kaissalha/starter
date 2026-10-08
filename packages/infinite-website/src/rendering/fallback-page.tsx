import type { ReactNode } from "react";

export const websiteFallbackActionClassName =
	"inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-[CanvasText] bg-[CanvasText] px-4 py-2.5 font-semibold text-[Canvas] no-underline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[Highlight]";

export const WebsiteFallbackPage = ({ children }: { children: ReactNode }) => (
	<main className='website-container'>
		<div className='grid min-h-dvh place-items-center bg-[Canvas] px-6 py-8 font-sans text-[CanvasText]'>
			<div className='grid max-w-lg justify-items-start gap-4'>{children}</div>
		</div>
	</main>
);
