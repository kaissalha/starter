import { vi } from "vitest";

vi.mock("@vercel/functions", () => ({
	waitUntil: vi.fn((fn) => fn),
}));
