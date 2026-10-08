"use client";

import { type CSSProperties, useState } from "react";

import { cn } from "cn";

import type { Alignment, FocalPoint, VideoPlayback } from "../document/structure-schema";
import type { ResolvedAsset } from "./shared";
import { resolveVideoSource, type VideoSource } from "./video-source";

type VideoAsset = Extract<ResolvedAsset, { type: "video" }>;

type VideoStatus = "loading" | "ready" | "error";

const VideoPoster = ({
	alt,
	fit,
	objectAlign,
	poster,
	style,
}: {
	alt?: string;
	fit: "cover" | "contain";
	objectAlign: Alignment;
	poster?: string;
	style: CSSProperties;
}) => {
	if (!poster) {
		return null;
	}

	return (
		<img
			alt={alt ?? ""}
			aria-hidden={alt ? undefined : "true"}
			className={cn(
				"iw-media-content block h-full w-full",
				fit === "contain" ? "object-contain" : "object-cover"
			)}
			data-object-align={objectAlign}
			src={poster}
			style={style}
		/>
	);
};

const VideoFallback = ({
	alt,
	fit,
	isBackground,
	objectAlign,
	poster,
	style,
}: {
	alt: string;
	fit: "cover" | "contain";
	isBackground: boolean;
	objectAlign: Alignment;
	poster?: string;
	style: CSSProperties;
}) => {
	if (poster) {
		return (
			<VideoPoster
				alt={isBackground ? undefined : alt}
				fit={fit}
				objectAlign={objectAlign}
				poster={poster}
				style={style}
			/>
		);
	}

	return (
		<div
			aria-label={isBackground ? undefined : alt}
			className='iw-media-content h-full w-full'
			role={isBackground ? undefined : "img"}
		/>
	);
};

const YouTubeVideo = ({
	alt,
	fit,
	hoverOpacity,
	isBackground,
	isReady,
	onLoad,
	source,
	style,
}: {
	alt: string;
	fit: "cover" | "contain";
	hoverOpacity?: number;
	isBackground: boolean;
	isReady: boolean;
	onLoad: () => void;
	source: VideoSource;
	style: CSSProperties;
}) => {
	return (
		<div
			className={cn(
				"absolute inset-0 overflow-hidden [container-type:size]",
				isBackground && "pointer-events-none"
			)}
		>
			<iframe
				allow='accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture'
				allowFullScreen={!isBackground}
				aria-hidden={isBackground ? "true" : undefined}
				className={cn(
					"iw-media-video-embed iw-media-video-reveal",
					hoverOpacity !== undefined && "iw-media-image"
				)}
				data-fit={fit}
				data-ready={isReady}
				loading='lazy'
				onLoad={onLoad}
				referrerPolicy='strict-origin-when-cross-origin'
				sandbox='allow-scripts allow-same-origin allow-presentation allow-popups'
				src={source.url}
				style={style}
				tabIndex={isBackground ? -1 : undefined}
				title={alt}
			/>
		</div>
	);
};

export const MediaVideo = ({
	alt,
	asset,
	contentScale,
	fit,
	focal,
	hoverOpacity,
	imageOpacity,
	objectAlign,
	playback,
}: {
	alt: string;
	asset: VideoAsset;
	contentScale?: number;
	fit: "cover" | "contain";
	focal?: FocalPoint;
	hoverOpacity?: number;
	imageOpacity?: number;
	objectAlign: Alignment;
	playback?: VideoPlayback;
}) => {
	const [status, setStatus] = useState<VideoStatus>("loading");
	const source = resolveVideoSource({ playback, poster: asset.poster, src: asset.src });
	const isBackground = playback === "background";

	const mediaStyle: CSSProperties = {
		objectPosition: focal ? `${focal.x}% ${focal.y}%` : undefined,
		scale: contentScale,
	};

	const posterStyle = { ...mediaStyle, opacity: imageOpacity };

	if (!source || status === "error") {
		return (
			<VideoFallback
				alt={alt}
				fit={fit}
				isBackground={isBackground}
				objectAlign={objectAlign}
				poster={source?.poster ?? asset.poster}
				style={posterStyle}
			/>
		);
	}

	const revealStyle: CSSProperties = { ...mediaStyle };
	revealStyle["--iw-media-opacity"] = imageOpacity ?? 1;
	const poster = <VideoPoster fit={fit} objectAlign={objectAlign} poster={source.poster} style={posterStyle} />;

	if (source.kind === "youtube") {
		return (
			<>
				{poster}
				<YouTubeVideo
					alt={alt}
					fit={fit}
					hoverOpacity={hoverOpacity}
					isBackground={isBackground}
					isReady={status === "ready"}
					onLoad={() => setStatus("ready")}
					source={source}
					style={revealStyle}
				/>
			</>
		);
	}

	return (
		<>
			{poster}
			<video
				aria-hidden={isBackground ? "true" : undefined}
				aria-label={isBackground ? undefined : alt}
				autoPlay={isBackground}
				className={cn(
					"iw-media-content iw-media-video-reveal h-full w-full",
					isBackground && "pointer-events-none",
					source.poster && "absolute inset-0",
					fit === "contain" ? "object-contain" : "object-cover",
					hoverOpacity !== undefined && "iw-media-image"
				)}
				controls={!isBackground}
				data-object-align={objectAlign}
				data-ready={status === "ready"}
				loop={isBackground}
				muted={isBackground}
				onCanPlay={() => setStatus("ready")}
				onError={() => setStatus("error")}
				playsInline
				preload={isBackground ? "auto" : "metadata"}
				src={source.url}
				style={revealStyle}
			/>
		</>
	);
};
