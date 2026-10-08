"use client";

import { useState } from "react";

import type { LinkPageDocument } from "@starter/infinite-links";

export type LinksDesignSection = "background" | "buttons" | "header" | "text" | "theme";

export type LinksEditorView =
	| { id: string; kind: "add-social" }
	| { id: string; kind: "block" }
	| { index: number; kind: "add-block"; placement: "header" | "page" }
	| { kind: "design"; section: LinksDesignSection }
	| { kind: "root" }
	| { kind: "agent" };

const linksEditorViewTarget = (view: LinksEditorView) => {
	if (view.kind === "block" || view.kind === "add-social") {
		return `block:${view.id}`;
	}

	return view.kind === "design" ? `design:${view.section}` : view.kind;
};

export const useLinksEditorView = ({
	document,
	restore,
}: {
	document: LinkPageDocument;
	restore: (document: LinkPageDocument) => void;
}) => {
	const [view, setViewState] = useState<LinksEditorView>({ kind: "root" });
	const [baseline, setBaseline] = useState<LinkPageDocument | null>(null);

	const setView = (nextView: LinksEditorView) => {
		setViewState(nextView);

		if (nextView.kind === "root" || nextView.kind === "agent") {
			setBaseline(null);
		} else if (
			baseline === null ||
			(view.kind !== "add-block" && linksEditorViewTarget(view) !== linksEditorViewTarget(nextView))
		) {
			setBaseline(document);
		}
	};

	const cancelView = () => {
		if (baseline) {
			restore(baseline);
		}

		setView({ kind: "root" });
	};

	return { baseline, cancelView, setView, view };
};
