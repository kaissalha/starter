"use client";

import { createContext, type ReactNode, useContext, useId, useRef } from "react";

import { DialogPortal } from "./dialog";

type RootPortalContextValue = {
	portalId: string;
};

export const RootPortalContext = createContext<RootPortalContextValue | null>(null);

export const useRootPortal = () => {
	return useContext(RootPortalContext);
};

export const RootPortal = DialogPortal;

export const RootPortalProvider = ({ children }: { children: ReactNode }) => {
	const portalId = useId();
	const rootRef = useRef<HTMLDivElement>(null);

	return (
		<RootPortalContext.Provider value={{ portalId }}>
			{children}
			<div id={portalId} ref={rootRef} />
		</RootPortalContext.Provider>
	);
};
