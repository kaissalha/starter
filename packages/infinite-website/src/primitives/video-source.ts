import type { VideoPlayback } from "../document/structure-schema";

export type VideoSource = {
	kind: "file" | "youtube";
	poster?: string;
	url: string;
};

const normalizeUrl = ({ src }: { src: string }) => {
	const trimmed = src.trim();

	if (!trimmed) {
		return undefined;
	}

	if (trimmed.startsWith("//")) {
		return undefined;
	}

	if (trimmed.startsWith("/") || trimmed.startsWith("blob:")) {
		return trimmed;
	}

	try {
		const url = new URL(/^https?:\/\//iu.test(trimmed) ? trimmed : `https://${trimmed}`);

		return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
	} catch {
		return undefined;
	}
};

const youtubeId = ({ src }: { src: string }) => {
	try {
		const url = new URL(src);
		const hostname = url.hostname.replace(/^www\./u, "");

		if (hostname === "youtu.be") {
			return url.pathname.split("/").filter(Boolean)[0];
		}

		if (hostname !== "youtube.com" && hostname !== "m.youtube.com") {
			return undefined;
		}

		if (url.pathname === "/watch") {
			return url.searchParams.get("v") ?? undefined;
		}

		const segments = url.pathname.split("/").filter(Boolean);

		return ["embed", "live", "shorts"].includes(segments[0] ?? "") ? segments[1] : undefined;
	} catch {
		return undefined;
	}
};

export const resolveVideoSource = ({
	playback,
	poster,
	src,
}: {
	playback?: VideoPlayback;
	poster?: string;
	src: string;
}) => {
	const url = normalizeUrl({ src });

	if (!url) {
		return undefined;
	}

	const isBackground = playback === "background";
	const youtubeVideoId = youtubeId({ src: url });

	if (youtubeVideoId) {
		const parameters = new URLSearchParams({
			autoplay: isBackground ? "1" : "0",
			controls: isBackground ? "0" : "1",
			mute: isBackground ? "1" : "0",
			playsinline: "1",
		});

		if (isBackground) {
			parameters.set("loop", "1");
			parameters.set("playlist", youtubeVideoId);
			parameters.set("disablekb", "1");
		}

		return {
			kind: "youtube",
			poster: poster ?? `https://i.ytimg.com/vi/${youtubeVideoId}/sddefault.jpg`,
			url: `https://www.youtube-nocookie.com/embed/${youtubeVideoId}?${parameters.toString()}`,
		} satisfies VideoSource;
	}

	return { kind: "file", poster, url } satisfies VideoSource;
};
