import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import "@testing-library/jest-dom/vitest";
import "./mocks/match-media";
import "./mocks/next-headers";
import "./mocks/next-intl";
import "./mocks/next-server";
import "./mocks/posthog";
import "./mocks/routing";
import "./mocks/vercel";
import "./mocks/web-apis";
import "./mocks/workflow";

process.env.RESEND_KEY = process.env.RESEND_KEY ?? "test-resend-key";

process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";

process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});
