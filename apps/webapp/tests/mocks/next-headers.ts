import { vi } from "vitest";

vi.mock("next/headers", () => ({
	cookies: () => ({
		get: vi.fn(),
		set: vi.fn(),
	}),
	headers: () => ({
		get: vi.fn(),
	}),
}));
