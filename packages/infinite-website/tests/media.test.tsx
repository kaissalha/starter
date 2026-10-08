// @vitest-environment happy-dom

import { type ReactNode, act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { siteNodeSchema } from "../src/document/structure-schema";
import { Media } from "../src/primitives/media";
import { resolvedAssetSchema } from "../src/primitives/shared";
import { resolveVideoSource } from "../src/primitives/video-source";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const renderClient = async ({ children }: { children: ReactNode }) => {
	const container = document.createElement("div");
	const root = createRoot(container);

	await act(async () => {
		root.render(children);
	});

	return { container, root };
};

describe("media", () => {
	it("keeps legacy image assets valid while applying conservative delivery defaults", () => {
		const asset = { src: "https://cdn.example.com/legacy.jpg" };
		const html = renderToStaticMarkup(<Media alt='Legacy image' asset={asset} assetId='asset' />);

		expect(resolvedAssetSchema.safeParse(asset).success).toBe(true);
		expect(html).toContain('decoding="async"');
		expect(html).toContain('loading="lazy"');
		expect(html).not.toContain('height="');
		expect(html).not.toContain('sizes="');
		expect(html).not.toContain('srcSet="');
		expect(html).not.toContain('width="');
	});

	it("renders host-owned intrinsic and responsive image metadata", () => {
		const html = renderToStaticMarkup(
			<Media
				alt='Responsive landscape'
				asset={{
					decoding: "sync",
					height: 675,
					loading: "eager",
					sizes: "(max-width: 48rem) 100vw, 50vw",
					sources: [
						{ src: "https://cdn.example.com/landscape-480.jpg", width: 480 },
						{ src: "https://cdn.example.com/landscape-1200.jpg", width: 1200 },
					],
					src: "https://cdn.example.com/landscape-1200.jpg",
					type: "image",
					width: 1200,
				}}
				assetId='asset'
			/>
		);

		expect(html).toContain('decoding="sync"');
		expect(html).toContain('height="675"');
		expect(html).toContain('loading="eager"');
		expect(html).toContain('sizes="(max-width: 48rem) 100vw, 50vw"');
		expect(html).toContain(
			'srcSet="https://cdn.example.com/landscape-480.jpg 480w, https://cdn.example.com/landscape-1200.jpg 1200w"'
		);
		expect(html).toContain('width="1200"');
	});

	it("rejects incomplete or unbounded responsive image metadata", () => {
		expect(resolvedAssetSchema.safeParse({ height: 675, src: "/image.jpg", type: "image" }).success).toBe(false);
		expect(
			resolvedAssetSchema.safeParse({
				height: 675,
				sources: [
					{ src: "/large.jpg", width: 1200 },
					{ src: "/small.jpg", width: 480 },
				],
				src: "/large.jpg",
				type: "image",
				width: 1200,
			}).success
		).toBe(false);
		expect(
			resolvedAssetSchema.safeParse({
				height: 675,
				sources: Array.from({ length: 7 }, (_, index) => ({
					src: `/image-${index}.jpg`,
					width: 320 + index * 160,
				})),
				src: "/image.jpg",
				type: "image",
				width: 1200,
			}).success
		).toBe(false);
	});

	it("renders a chrome-free direct video with autoplay-safe playback and a poster", () => {
		const html = renderToStaticMarkup(
			<Media
				alt='A flower moving in the breeze'
				asset={{
					poster: "https://cdn.example.com/ambient-poster.jpg",
					src: "https://cdn.example.com/ambient-stream",
					type: "video",
				}}
				assetId='asset'
				playback='background'
			/>
		);

		expect(html).toContain("<video");
		expect(html).toContain('autoPlay=""');
		expect(html).not.toContain('controls=""');
		expect(html).toContain('loop=""');
		expect(html).toContain('muted=""');
		expect(html).toContain('playsInline=""');
		expect(html).toContain('src="https://cdn.example.com/ambient-poster.jpg"');
		expect(html).toContain('aria-hidden="true"');
		expect(html).toContain('aria-label="A flower moving in the breeze"');
		expect(html).toContain('data-ready="false"');
		expect(html).toContain("pointer-events-none");
	});

	it("uses a lazy privacy-enhanced YouTube background with a derived poster", () => {
		const html = renderToStaticMarkup(
			<Media
				alt='Product film'
				asset={{ src: "https://youtu.be/M7lc1UVf-VE", type: "video" }}
				assetId='asset'
				playback='background'
			/>
		);

		expect(html).toContain("https://i.ytimg.com/vi/M7lc1UVf-VE/sddefault.jpg");
		expect(html).toContain("<iframe");
		expect(html).toContain('aria-hidden="true"');
		expect(html).toContain('data-ready="false"');
		expect(html).toContain('loading="lazy"');
		expect(html).toContain('tabindex="-1"');

		expect(html).toContain(
			"https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?autoplay=1&amp;controls=0&amp;mute=1&amp;playsinline=1&amp;loop=1&amp;playlist=M7lc1UVf-VE&amp;disablekb=1"
		);

		expect(html).toContain('title="Product film"');
	});

	it("keeps standalone video interactive", () => {
		const defaultPlayer = renderToStaticMarkup(
			<Media alt='Product film' asset={{ src: "https://youtu.be/M7lc1UVf-VE", type: "video" }} assetId='asset' />
		);

		expect(defaultPlayer).toContain("autoplay=0&amp;controls=1&amp;mute=0&amp;playsinline=1");
		expect(defaultPlayer).toContain("<iframe");
		expect(defaultPlayer).toContain('allowFullScreen=""');
		expect(defaultPlayer).toContain('data-ready="false"');
		expect(defaultPlayer).not.toContain("disablekb=1");
		expect(defaultPlayer).not.toContain("pointer-events-none");
	});

	it("accepts arbitrary trusted video URLs while rejecting active URL schemes", () => {
		expect(resolveVideoSource({ src: "https://media.example.com/playback?id=42" })).toMatchObject({
			kind: "file",
			url: "https://media.example.com/playback?id=42",
		});

		expect(resolveVideoSource({ src: "javascript:alert(1)" })).toBeUndefined();
		expect(resolveVideoSource({ src: "//media.example.com/playback" })).toBeUndefined();
	});

	it("shows the poster when a direct video fails", async () => {
		const { container, root } = await renderClient({
			children: (
				<Media
					alt='Product film'
					asset={{
						poster: "https://cdn.example.com/product.jpg",
						src: "https://cdn.example.com/product.mp4",
						type: "video",
					}}
					assetId='asset'
				/>
			),
		});

		const video = container.querySelector("video");
		expect(video).not.toBeNull();

		await act(async () => {
			video?.dispatchEvent(new Event("error"));
		});

		expect(container.querySelector("video")).toBeNull();
		expect(container.querySelector("img")?.getAttribute("alt")).toBe("Product film");

		await act(async () => {
			root.unmount();
		});
	});

	it("shows a labelled placeholder when failed media has no poster", async () => {
		const { container, root } = await renderClient({
			children: (
				<Media
					alt='Product film'
					asset={{ src: "https://cdn.example.com/product.mp4", type: "video" }}
					assetId='asset'
				/>
			),
		});

		const video = container.querySelector("video");

		await act(async () => {
			video?.dispatchEvent(new Event("error"));
		});

		expect(container.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe("Product film");

		await act(async () => {
			root.unmount();
		});
	});

	it("renders solid and directional contrast overlays above media", () => {
		const scrim = renderToStaticMarkup(
			<Media
				alt='Mountain range'
				asset={{ src: "https://cdn.example.com/mountain.jpg" }}
				assetId='asset'
				overlay={{ kind: "scrim", strength: "strong" }}
			/>
		);

		const gradient = renderToStaticMarkup(
			<Media
				alt='Mountain range'
				asset={{ src: "https://cdn.example.com/mountain.jpg" }}
				assetId='asset'
				overlay={{
					angle: 90,
					kind: "linear-gradient",
					stops: [
						{ opacity: 0.8, position: 0 },
						{ opacity: 0, position: 100 },
					],
				}}
			/>
		);

		expect(scrim).toContain('data-media-overlay="scrim"');
		expect(scrim).toContain("background:rgb(0 0 0 / 0.6)");
		expect(gradient).toContain('data-media-overlay="linear-gradient"');
		expect(gradient).toContain("linear-gradient(90deg, rgb(0 0 0 / 0.8) 0%, rgb(0 0 0 / 0) 100%)");
	});

	it("persists overlay and playback settings in the closed media node schema", () => {
		const persistedMediaNode = {
			id: "e9eca74e-cd0c-4ef0-873c-72b424314194",
			props: {
				alt: { $text: "/media/items/0/alt" },
				assetId: { $asset: "/media/items/0/assetId" },
				overlay: { kind: "scrim", strength: "strong" },
				playback: "background",
			},
			type: "media",
		};

		expect(siteNodeSchema.safeParse(persistedMediaNode).success).toBe(true);

		expect(
			siteNodeSchema.safeParse({
				...persistedMediaNode,
				props: { ...persistedMediaNode.props, playback: "ambient" },
			}).success
		).toBe(false);
	});
});
