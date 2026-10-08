const youTubeHosts = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]);

export const resolveYouTubeVideoId = (value: string) => {
	if (!URL.canParse(value)) {
		return null;
	}

	const url = new URL(value);

	if (!youTubeHosts.has(url.hostname)) {
		return null;
	}

	const candidate =
		url.hostname === "youtu.be"
			? url.pathname.split("/").filter(Boolean)[0]
			: (url.searchParams.get("v") ?? /^\/(?:embed|shorts|live|v)\/([^/?]+)/u.exec(url.pathname)?.[1]);

	return candidate && /^[\w-]{11}$/u.test(candidate) ? candidate : null;
};

const embedProviders = {
	applemusic: { height: 175, hosts: ["music.apple.com"] },
	applepodcasts: { height: 175, hosts: ["podcasts.apple.com"] },
	soundcloud: { height: 166, hosts: ["soundcloud.com", "on.soundcloud.com"] },
	spotify: { height: 152, hosts: ["open.spotify.com"] },
	tiktok: { height: 580, hosts: ["tiktok.com", "www.tiktok.com", "vm.tiktok.com"] },
	vimeo: { height: 0, hosts: ["vimeo.com"] },
	youtube: { height: 0, hosts: [...youTubeHosts] },
} as const;

export type LinkPageEmbed = { height: number; provider: keyof typeof embedProviders; src: string };

export const resolveLinkPageEmbed = (value: string): LinkPageEmbed | null => {
	if (!URL.canParse(value)) {
		return null;
	}

	const url = new URL(value);
	const host = url.hostname.replace(/^www\./u, "");
	const path = url.pathname.split("/").filter(Boolean);
	const videoId = resolveYouTubeVideoId(value);

	if (videoId) {
		return { height: 0, provider: "youtube", src: `https://www.youtube-nocookie.com/embed/${videoId}` };
	}

	const playlist = url.searchParams.get("list");

	if (youTubeHosts.has(url.hostname) && url.pathname === "/playlist" && playlist) {
		return {
			height: 0,
			provider: "youtube",
			src: `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(playlist)}`,
		};
	}

	if (host === "vimeo.com" && /^\d+$/u.test(path[0] ?? "")) {
		return { height: 0, provider: "vimeo", src: `https://player.vimeo.com/video/${path[0]}` };
	}

	if (host === "podcasts.apple.com") {
		return {
			height: url.searchParams.has("i") ? 175 : 450,
			provider: "applepodcasts",
			src: `https://embed.podcasts.apple.com${url.pathname}${url.search}`,
		};
	}

	if (host === "open.spotify.com" && path.length >= 2) {
		const [type, id] = path.at(-2) === "embed" ? path.slice(-2) : path.slice(0, 2);
		const collection = type === "album" || type === "playlist" || type === "show" || type === "artist";

		return type && id
			? {
					height: collection ? 352 : 152,
					provider: "spotify",
					src: `https://open.spotify.com/embed/${type}/${id}`,
				}
			: null;
	}

	if (host === "music.apple.com") {
		const collection = !url.searchParams.has("i");

		return {
			height: collection ? 450 : 175,
			provider: "applemusic",
			src: `https://embed.music.apple.com${url.pathname}${url.search}`,
		};
	}

	if (host === "soundcloud.com" || host === "on.soundcloud.com") {
		return {
			height: 166,
			provider: "soundcloud",
			src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.href)}&visual=false`,
		};
	}

	if (embedProviders.tiktok.hosts.some((candidate) => candidate === url.hostname) && path.at(-2) === "video") {
		return { height: 580, provider: "tiktok", src: `https://www.tiktok.com/embed/v2/${path.at(-1)}` };
	}

	return null;
};
