"use client";

import { type ReactNode, createContext, use } from "react";

const DocumentViewerToolbarLeadingContext = createContext<ReactNode>(null);

export const DocumentViewerToolbarLeadingProvider = DocumentViewerToolbarLeadingContext;

export const useDocumentViewerToolbarLeading = () => use(DocumentViewerToolbarLeadingContext);
