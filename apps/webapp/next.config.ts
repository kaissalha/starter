import type { NextConfig } from "next";

import { withPostHogConfig } from "@posthog/nextjs-config";
import withVercelToolbar from "@vercel/toolbar/plugins/next";
import { withEnvStyles } from "env.style";
import createNextIntlPlugin from "next-intl/plugin";
import { withWorkflow } from "workflow/next";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
	allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean),
	cacheComponents: true,
	devIndicators: process.env.PLAYWRIGHT_TEST === "1" ? false : undefined,
	distDir: process.env.PLAYWRIGHT_TEST === "1" ? ".next-e2e" : ".next",
	experimental: {
		agentFeedback: true,
		agentUpgrade: "latest",
		cachedNavigations: true,
		inlineCss: true,
		mdxRs: true,
		turbopackGc: true,
		turbopackLazyDynamicImports: true,
		turbopackRustReactCompiler: true,
		typedEnv: true,
		useTypeScriptCli: true,
	},
	headers: async () => [
		{
			headers: [
				{
					key: "Cache-Control",
					value: "public, max-age=86400, stale-while-revalidate=604800",
				},
			],
			source: "/images/:path*",
		},
		{
			headers: [
				{ key: "Content-Security-Policy", value: "frame-ancestors 'none';" },
				{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
				{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
				{ key: "X-Content-Type-Options", value: "nosniff" },
				{ key: "X-Frame-Options", value: "DENY" },
			],
			source: "/:path*",
		},
	],
	images: {
		unoptimized: true,
	},
	partialPrefetching: true,
	reactCompiler: true,
	async rewrites() {
		return {
			afterFiles: [],
			beforeFiles: [
				{
					destination: "https://www.dubcdn.com/analytics/script.js",
					source: "/umbra/script.js",
				},
				{
					destination: "https://api.dub.co/:path",
					source: "/umbra/:path",
				},
			],
			fallback: [],
		};
	},
	serverExternalPackages: [
		"@mastra/ai-sdk",
		"@mastra/core",
		"@mastra/memory",
		"@mastra/observability",
		"@mastra/pg",
		"@mastra/rag",
		"jsonpath",
		"@vectorstores/readers",
	],
	skipTrailingSlashRedirect: true,
	typedRoutes: true,
};

const { POSTHOG_PERSONAL_API_KEY: personalApiKey, POSTHOG_PROJECT_ID: envId, VERCEL_ENV } = process.env;

if (VERCEL_ENV === "production" && (!personalApiKey || !envId)) {
	throw new Error("POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID must be set for production builds");
}

const config = withVercelToolbar()(withNextIntl(nextConfig));

export default withEnvStyles(
	withWorkflow(
		personalApiKey && envId
			? withPostHogConfig(config, {
					envId,
					personalApiKey,
					sourcemaps: { deleteAfterUpload: true, enabled: VERCEL_ENV === "production", project: "webapp" },
				})
			: config
	)
);
