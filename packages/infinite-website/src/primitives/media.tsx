import type { CSSProperties, ReactNode } from "react";

import { cn } from "cn";

import type { Alignment, Layout, MediaOverlay } from "../document/structure-schema";
import { appearance } from "./appearance";
import { layoutStyle } from "./layout";
import { MediaVideo } from "./media-video";
import type { NodeProps, ResolvedAsset } from "./shared";

const scrimOpacity = { medium: 0.35, strong: 0.6, subtle: 0.2 } as const;

const overlayBackground = ({ overlay }: { overlay: MediaOverlay }) => {
	if (overlay.kind === "scrim") {
		return `rgb(0 0 0 / ${scrimOpacity[overlay.strength]})`;
	}

	return `linear-gradient(${overlay.angle}deg, ${overlay.stops
		.map((stop) => `rgb(0 0 0 / ${stop.opacity}) ${stop.position}%`)
		.join(", ")})`;
};

const imageFilter = {
	grayscale: "grayscale(1)",
	none: undefined,
	silhouette: "brightness(0)",
	"silhouette-light": "brightness(0) invert(1)",
};

const MediaContent = ({
	alt,
	asset,
	contentScale,
	filter,
	fit,
	focal,
	hoverOpacity,
	imageOpacity,
	intrinsicInlineSize,
	objectAlign,
	playback,
}: Pick<
	NodeProps<"media">,
	"alt" | "filter" | "focal" | "contentScale" | "intrinsicInlineSize" | "imageOpacity" | "hoverOpacity" | "playback"
> & { asset?: ResolvedAsset; fit: "cover" | "contain"; objectAlign: Alignment }) => {
	if (!asset) {
		return null;
	}

	if (asset.type === "video") {
		return (
			<MediaVideo
				alt={alt}
				asset={asset}
				contentScale={contentScale}
				fit={fit}
				focal={focal}
				hoverOpacity={hoverOpacity}
				imageOpacity={imageOpacity}
				key={`${asset.src}:${playback ?? "player"}`}
				objectAlign={objectAlign}
				playback={playback}
			/>
		);
	}

	return (
		<img
			alt={alt}
			className={cn(
				"iw-media-content h-full",
				intrinsicInlineSize ? "w-auto" : "w-full",
				fit === "contain" ? "object-contain" : "object-cover",
				hoverOpacity !== undefined && "iw-media-image"
			)}
			data-object-align={objectAlign}
			decoding={asset.decoding ?? "async"}
			height={asset.height}
			loading={asset.loading ?? "lazy"}
			sizes={asset.sources ? (asset.sizes ?? "100vw") : undefined}
			src={asset.src}
			srcSet={asset.sources?.map((source) => `${source.src} ${source.width}w`).join(", ")}
			style={{
				filter: imageFilter[filter ?? "none"],
				objectPosition: focal ? `${focal.x}% ${focal.y}%` : undefined,
				opacity: imageOpacity,
				scale: contentScale,
			}}
			width={asset.width}
		/>
	);
};

export const Media = ({
	alt,
	asset,
	assetId: _assetId,
	background,
	border,
	clip = true,
	contentScale,
	controls,
	fill,
	fillOpacity,
	filter,
	fit = "cover",
	focal,
	foreground,
	hoverOpacity,
	imageOpacity,
	intrinsicInlineSize = false,
	layout,
	objectAlign = "center",
	opacity,
	overlay,
	playback,
	radius,
}: NodeProps<"media"> & { asset?: ResolvedAsset; controls?: ReactNode; layout?: Layout }) => {
	const visual = appearance({
		background,
		border,
		fill,
		fillOpacity,
		foreground,
		opacity,
		radius,
		radiusRole: "media",
	});

	const positionedLayout = layout
		? { ...layout, position: layout.position ?? "relative" }
		: { position: "relative" as const };

	const frameStyle: CSSProperties = {
		...layoutStyle(clip ? { ...positionedLayout, overflow: "hidden" } : positionedLayout),
		...visual.style,
	};

	if (hoverOpacity !== undefined) {
		frameStyle["--iw-media-hover-opacity"] = hoverOpacity;
	}

	const isBackgroundVideo = asset?.type === "video" && playback === "background";

	return (
		<div
			aria-label={!asset || isBackgroundVideo ? alt : undefined}
			className={cn("iw-media-frame iw-layout iw-box group", visual.className)}
			role={!asset || isBackgroundVideo ? "img" : undefined}
			style={frameStyle}
		>
			<MediaContent
				alt={alt}
				asset={asset}
				contentScale={contentScale}
				filter={filter}
				fit={fit}
				focal={focal}
				hoverOpacity={hoverOpacity}
				imageOpacity={imageOpacity}
				intrinsicInlineSize={intrinsicInlineSize}
				objectAlign={objectAlign}
				playback={playback}
			/>
			{controls}
			{overlay && (
				<div
					aria-hidden='true'
					className='pointer-events-none absolute inset-0'
					data-media-overlay={overlay.kind}
					style={{ background: overlayBackground({ overlay }) }}
				/>
			)}
		</div>
	);
};
