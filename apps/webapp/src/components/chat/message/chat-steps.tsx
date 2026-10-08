"use client";

import type { ReactNode } from "react";

export const ChatSteps = ({ children }: { children: ReactNode }) => {
	return <div className='my-1 flex flex-col'>{children}</div>;
};

ChatSteps.displayName = "ChatSteps";
