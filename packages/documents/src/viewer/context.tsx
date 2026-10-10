"use client";

import { type ReactNode, createContext, use } from "react";

const defaultDocumentViewerLabels = {
	clear: "Clear",
	columnMenu: "Column menu",
	comments: "Comments",
	document: "Document",
	edits: "Edits",
	fileTooLarge: "File too large",
	fileTooLargeDescription: "This file exceeds the display limit. Download it to view the full file.",
	loading: "Loading",
	moreActions: "More actions",
	nextResult: "Next result",
	of: "of",
	page: "Page",
	pageNumber: "Page number",
	pagesSidebar: "Pages sidebar",
	previousResult: "Previous result",
	rotateClockwise: "Rotate clockwise",
	rotateCounterclockwise: "Rotate counterclockwise",
	search: "Search",
	sortAscending: "Sort ascending",
	sortDescending: "Sort descending",
	toggleThumbnails: "Toggle thumbnails",
	unableToDisplay: "Unable to display this file.",
	upload: "Upload",
	zoom: "Zoom",
	zoomIn: "Zoom in",
	zoomLevel: "Zoom level",
	zoomOut: "Zoom out",
};

const DocumentViewerLabelsContext = createContext(defaultDocumentViewerLabels);

export const DocumentViewerLabelsProvider = DocumentViewerLabelsContext;

export const useDocumentViewerLabels = () => use(DocumentViewerLabelsContext);

const DocumentViewerToolbarLeadingContext = createContext<ReactNode>(null);

export const DocumentViewerToolbarLeadingProvider = DocumentViewerToolbarLeadingContext;

export const useDocumentViewerToolbarLeading = () => use(DocumentViewerToolbarLeadingContext);
