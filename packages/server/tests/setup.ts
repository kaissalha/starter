import { vi } from "vitest";

process.env.AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY ?? "test-gateway-key";

process.env.RESEND_KEY = process.env.RESEND_KEY ?? "test-resend-key";

process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id";

process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";

const log = {
	debug: vi.fn(),
	error: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
};

vi.mock("@starter/observability", async (importOriginal) => ({
	...(await importOriginal<typeof import("@starter/observability")>()),
	log,
}));
