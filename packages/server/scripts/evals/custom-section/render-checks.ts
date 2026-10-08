import { createElement } from "react";

import { chromium, type Browser, type Page } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { resolveTextDirection, SiteRenderer } from "@starter/infinite-website";
import type { WebsiteSnapshotV1 } from "@starter/infinite-website/contracts";

import { inspectSection, type ViewportReport } from "./browser-inspection";

export type { ViewportReport };

export const viewports = [390, 834, 1440] as const;

const websitePackage = path.resolve(import.meta.dirname, "../../../../infinite-website");

const stylesheets = [
	path.resolve(import.meta.dirname, "../../../../infinite-brand/src/fonts/fonts.css"),
	path.join(websitePackage, "dist/styles.css"),
];

const websiteRequire = createRequire(path.join(websitePackage, "package.json"));

const browsers = new Map<"main", Promise<Browser>>();

const getBrowser = () => {
	const existing = browsers.get("main");

	if (existing) {
		return existing;
	}

	const launched = chromium.launch();
	browsers.set("main", launched);

	return launched;
};

export const closeBrowser = async () => {
	const launched = browsers.get("main");
	browsers.delete("main");
	await (await launched)?.close();
};

const renderPage = ({ locale, snapshot }: { locale: "ar" | "en"; snapshot: WebsiteSnapshotV1 }) => {
	const { renderToStaticMarkup }: typeof import("react-dom/server") = websiteRequire("react-dom/server");

	const body = renderToStaticMarkup(
		createElement(SiteRenderer, {
			assets: snapshot.assets,
			brand: snapshot.brand,
			document: snapshot.document,
			locale,
		})
	);

	const direction = resolveTextDirection({ direction: snapshot.document.direction, locale });
	const links = stylesheets.map((file) => `<link rel="stylesheet" href="file://${file}">`).join("");

	return `<!doctype html><html lang="${locale}" dir="${direction}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${links}</head><body style="margin:0">${body}</body></html>`;
};

const loadImages = async (sectionId: string) => {
	const images = [...(document.getElementById(sectionId)?.querySelectorAll("img") ?? [])];

	for (const image of images) {
		image.loading = "eager";
	}

	await Promise.all(
		images.map(async (image) => {
			try {
				await image.decode();
			} catch {
				return;
			}
		})
	);
};

const measureContext = (sectionId: string) => {
	const element = document.getElementById(sectionId);
	const first = element?.previousElementSibling ?? element;
	const last = element?.nextElementSibling ?? element;

	if (!first || !last) {
		return null;
	}

	const top = first.getBoundingClientRect().top + window.scrollY;

	return { height: Math.min(last.getBoundingClientRect().bottom + window.scrollY - top, 2800), top };
};

const captureViewport = async ({
	outDir,
	page,
	sectionId,
	width,
}: {
	outDir: string;
	page: Page;
	sectionId: string;
	width: number;
}) => {
	await page.setViewportSize({ height: 900, width });
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	await page.waitForTimeout(150);
	const section = page.locator(`[id="${sectionId}"]`);
	await section.scrollIntoViewIfNeeded();
	await page.evaluate(loadImages, sectionId);
	const report = await page.evaluate(inspectSection, sectionId);
	await section.screenshot({ path: path.join(outDir, `section-${width}.png`) });
	const span = await page.evaluate(measureContext, sectionId);

	if (span) {
		await page.screenshot({
			clip: { height: span.height, width, x: 0, y: span.top },
			fullPage: true,
			path: path.join(outDir, `context-${width}.png`),
		});
	}

	return report;
};

export const renderAndCheck = async ({
	locale,
	outDir,
	sectionId,
	snapshot,
}: {
	locale: "ar" | "en";
	outDir: string;
	sectionId: string;
	snapshot: WebsiteSnapshotV1;
}) => {
	const missing = stylesheets.filter((file) => !existsSync(file));

	if (missing.length > 0) {
		throw new Error(`Missing stylesheet ${missing.join(", ")}; run bun --filter @starter/infinite-website build`);
	}

	mkdirSync(outDir, { recursive: true });
	const htmlPath = path.join(outDir, "page.html");
	writeFileSync(htmlPath, renderPage({ locale, snapshot }));
	const page = await (await getBrowser()).newPage();

	try {
		await page.goto(`file://${htmlPath}`);
		const reports: Array<[number, ViewportReport]> = [];

		for (const width of viewports) {
			reports.push([width, await captureViewport({ outDir, page, sectionId, width })]);
		}

		return Object.fromEntries(reports);
	} finally {
		await page.close();
	}
};
