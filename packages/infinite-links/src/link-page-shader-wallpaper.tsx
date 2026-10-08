"use client";

import { MeshGradient, NeuroNoise } from "@paper-design/shaders-react";

import type { LinkPageWallpaper } from "./contracts";

export const LinkPageShaderWallpaper = ({ animation }: { animation: NonNullable<LinkPageWallpaper["animation"]> }) => {
	const className = "pointer-events-none absolute inset-0 size-full motion-reduce:hidden";

	if (animation.shader === "neuro") {
		return (
			<NeuroNoise
				aria-hidden='true'
				brightness={animation.brightness}
				className={className}
				colorBack={animation.colors[2]}
				colorFront={animation.colors[0]}
				colorMid={animation.colors[1]}
				contrast={animation.intensity}
				data-links-animated-wallpaper=''
				scale={animation.scale}
				speed={animation.speed}
			/>
		);
	}

	return (
		<MeshGradient
			aria-hidden='true'
			className={className}
			colors={animation.colors}
			data-links-animated-wallpaper=''
			distortion={animation.intensity}
			scale={animation.scale}
			speed={animation.speed}
			swirl={animation.swirl}
		/>
	);
};
