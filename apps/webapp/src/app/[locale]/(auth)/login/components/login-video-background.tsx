"use client";

import { useCallback, useState } from "react";

import Image from "next/image";

import { useBreakpoint } from "@starter/ui/hooks/use-breakpoint";

const POSTER =
	"https://midday.ai/cdn-cgi/image/width=1000,quality=80,format=auto/https://cdn.midday.ai/video-poster-v2.jpg";

const playVideo = async (video: HTMLVideoElement) => {
	try {
		await video.play();
	} catch {}
};

const LoginVideoPanel = () => {
	const [isVideoLoaded, setIsVideoLoaded] = useState(false);

	const markVideoLoaded = () => setIsVideoLoaded(true);

	const setupVideo = useCallback((video: HTMLVideoElement | null) => {
		if (!video) {
			return;
		}

		video.loop = true;
		video.muted = true;

		video.setAttribute("muted", "");
		video.setAttribute("playsinline", "");

		if (video.readyState >= 3) {
			setIsVideoLoaded(true);
		}
	}, []);

	return (
		<div className='m-2 relative hidden overflow-hidden rounded-lg border border-border lg:flex lg:w-1/2'>
			<div
				className={`absolute inset-0 h-full w-full transition-all duration-1000 ease-in-out ${
					isVideoLoaded ? "pointer-events-none opacity-0" : "opacity-100"
				}`}
				style={{
					filter: isVideoLoaded ? "blur(0px)" : "blur(1px)",
				}}
			>
				<div className='relative h-full w-full'>
					<Image
						alt=''
						aria-hidden
						className='object-cover'
						fill
						priority
						sizes='(min-width: 1024px) 50vw, 0px'
						src={POSTER}
					/>
				</div>
			</div>

			<video
				autoPlay
				className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${
					isVideoLoaded ? "opacity-100" : "opacity-0"
				}`}
				loop
				muted
				onCanPlay={markVideoLoaded}
				onCanPlayThrough={markVideoLoaded}

				onEnded={(event) => {
					const video = event.currentTarget;
					video.currentTime = 0;
					playVideo(video);
				}}
				onLoadedData={markVideoLoaded}
				onStalled={(event) => {
					const video = event.currentTarget;

					if (video.paused) {
						playVideo(video);
					}
				}}
				playsInline
				poster={POSTER}
				preload='auto'
				ref={setupVideo}
			>
				<source src='https://cdn.midday.ai/videos/login-video.mp4' type='video/mp4' />
			</video>

			<div className='absolute inset-0 bg-black/20' />
		</div>
	);
};

export const LoginVideoBackground = () => (useBreakpoint("lg") ? <LoginVideoPanel /> : null);
