import { useId, type CSSProperties } from "react";

import type { LinkPageAppearance } from "./contracts";

const noiseLayer = `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='0.1'/></svg>")}")`;

export const LinkPageWallpaper = ({ wallpaper }: { wallpaper: LinkPageAppearance["wallpaper"] }) => {
	const id = useId();

	const colors = wallpaper.gradientColors ?? [
		"var(--surface-featured)",
		"var(--surface-canvas)",
		"var(--foreground-primary)",
	];

	return (
		<svg
			aria-hidden='true'
			className='pointer-events-none absolute inset-0 size-full motion-reduce:hidden'
			data-links-animated-wallpaper=''
			preserveAspectRatio='none'
			viewBox='0 0 100 100'
		>
			<defs>
				{colors.map((color, index) => (
					<radialGradient
						cx={`${20 + index * 30}%`}
						cy={`${15 + index * 30}%`}
						id={`${id}-${index}`}
						key={index}
						r='80%'
					>
						<stop offset='0%' stopColor={color} />
						<stop offset='100%' stopColor={color} stopOpacity={0} />
						<animate
							attributeName='cx'
							dur={`${24 + index * 8}s`}
							repeatCount='indefinite'
							values={index === 1 ? "80%;20%;80%" : "20%;80%;20%"}
						/>
						<animate
							attributeName='cy'
							dur={`${32 + index * 8}s`}
							repeatCount='indefinite'
							values={index === 2 ? "80%;15%;80%" : "15%;80%;15%"}
						/>
					</radialGradient>
				))}
			</defs>
			{colors.map((color, index) => (
				<rect fill={`url(#${id}-${index})`} height='100' key={`${index}-${color}`} width='100' />
			))}
		</svg>
	);
};

export const linkPageWallpaperStyle = ({
	accent = "var(--surface-featured)",
	wallpaper,
	background = wallpaper.color ?? "var(--surface-canvas)",
	foreground = "var(--foreground-primary)",
}: {
	accent?: string;
	background?: string;
	foreground?: string;
	wallpaper: LinkPageAppearance["wallpaper"];
}): CSSProperties => {
	const color = `color-mix(in srgb, ${foreground} 9%, transparent)`;
	const [first, second, third] = wallpaper.gradientColors ?? [accent, background, foreground];

	const layers = (style: CSSProperties): CSSProperties =>
		wallpaper.noise
			? {
					...style,
					backgroundImage: [noiseLayer, style.backgroundImage].filter(Boolean).join(", "),
					backgroundPosition: style.backgroundPosition ? `0 0, ${style.backgroundPosition}` : undefined,
					backgroundSize: style.backgroundSize
						? `200px 200px, ${style.backgroundSize}`
						: "200px 200px, cover",
				}
			: style;

	const stops = wallpaper.gradient
		? `linear-gradient(${wallpaper.gradient.angle}deg, ${wallpaper.gradient.stops.map((stop) => `${stop.color} ${stop.position}%`).join(", ")})`
		: null;

	const overlay = wallpaper.overlay
		? `color-mix(in srgb, ${wallpaper.overlay.color} ${Math.round(wallpaper.overlay.amount * 100)}%, transparent)`
		: `color-mix(in srgb, ${background} 24%, transparent)`;

	const patterns = {
		polka: {
			backgroundImage: `radial-gradient(circle, ${color} 2px, transparent 2.5px)`,
			backgroundSize: "22px 22px",
		},
		stripe: { backgroundImage: `repeating-linear-gradient(135deg, ${color} 0 10px, transparent 10px 26px)` },
		waves: {
			backgroundImage: `radial-gradient(circle at 100% 50%, transparent 20%, ${color} 21%, ${color} 34%, transparent 35%), radial-gradient(circle at 0% 50%, transparent 20%, ${color} 21%, ${color} 34%, transparent 35%)`,
			backgroundPosition: "0 0, 26px 26px",
			backgroundSize: "52px 52px",
		},
		zigzag: {
			backgroundImage: `linear-gradient(135deg, ${color} 25%, transparent 25%), linear-gradient(225deg, ${color} 25%, transparent 25%), linear-gradient(315deg, ${color} 25%, transparent 25%), linear-gradient(45deg, ${color} 25%, transparent 25%)`,
			backgroundPosition: "-14px 0, -14px 0, 0 0, 0 0",
			backgroundSize: "28px 28px",
		},
	};

	switch (wallpaper.style) {
		case "fill":
			return layers({ backgroundColor: background });
		case "image":
			return wallpaper.imageUrl
				? layers({
						backgroundColor: background,
						backgroundImage: `linear-gradient(${overlay}, ${overlay}), url(${JSON.stringify(wallpaper.imageUrl)})`,
						backgroundPosition: "center",
						backgroundSize: "cover",
					})
				: layers({ backgroundColor: background });
		case "gradient":
			return layers({
				backgroundColor: background,
				backgroundImage:
					stops ??
					`linear-gradient(to ${wallpaper.gradientDirection === "down" ? "bottom" : "top"}, ${wallpaper.gradientColors ? `${first}, ${second} 50%, ${third}` : `${accent}, ${background} 72%`})`,
			});
		case "split":
			return layers({
				backgroundColor: background,
				backgroundImage: stops ?? `linear-gradient(155deg, ${first} 0 50%, ${second} 50% 100%)`,
			});
		case "mesh":
		case "animated":
			return layers({
				backgroundColor: background,
				backgroundImage: `radial-gradient(ellipse at 12% 12%, ${first}, transparent 65%), radial-gradient(ellipse at 85% 40%, ${second}, transparent 65%), radial-gradient(ellipse at 20% 95%, ${third}, transparent 65%)`,
			});
		case "pattern":
			return layers({ backgroundColor: background, ...patterns[wallpaper.pattern] });
	}
};
