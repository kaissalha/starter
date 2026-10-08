import { vi } from "vitest";

export const startMock = vi.fn().mockResolvedValue({ runId: "mock-run-id" });

export const fetchMock = vi.fn().mockImplementation(globalThis.fetch);

vi.mock("workflow/api", () => ({
	start: startMock,
}));

vi.mock("workflow", () => ({
	fetch: fetchMock,
}));
