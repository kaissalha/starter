import type * as React from "react";

export const ZOOM_MODE_LABELS = {
	"fit-page": "Fit page",
	"fit-width": "Fit width",
	automatic: "Automatic",
};

export type ZoomModeLevel = keyof typeof ZOOM_MODE_LABELS;

export function isZoomMode(value: string): value is ZoomModeLevel {
	return value in ZOOM_MODE_LABELS;
}

export function formatFileName(fileName: string | undefined, url: string, fallback: string) {
	if (fileName?.trim()) return fileName;
	const pathname = url.split("?")[0] ?? "";
	const rawName = pathname.split("/").pop() ?? fallback;
	try {
		return decodeURIComponent(rawName);
	} catch {
		return rawName;
	}
}

export function ensureExtension(fileName: string, extensions: string[]) {
	const lowerFileName = fileName.toLowerCase();
	return extensions.some((extension) => lowerFileName.endsWith(`.${extension}`))
		? fileName
		: `${fileName}.${extensions[0]}`;
}

export function downloadBlob(blob: Blob, fileName: string) {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = fileName;
	anchor.rel = "noopener";
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function composeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
	return (node: T | null) => {
		for (const ref of refs) {
			if (!ref) continue;
			if (typeof ref === "function") ref(node);
			else ref.current = node;
		}
	};
}
