import { PostHogProvider } from "@posthog/next";

import "server-only";

export const BaseLayoutPostHogProvider = ({ children }: { children: React.ReactNode }) => {
	return (
		<PostHogProvider
			clientOptions={{
				api_host: "/ingest",
				capture_exceptions: true,
				capture_pageleave: true,
			}}
			serverOptions={{
				enableExceptionAutocapture: true,
			}}
		>
			{children}
		</PostHogProvider>
	);
};
