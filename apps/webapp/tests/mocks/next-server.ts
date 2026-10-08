import { vi } from "vitest";

vi.mock("next/server", async () => {
	const actual = await vi.importActual<typeof import("next/server")>("next/server");

	return {
		...actual,
		after: vi.fn((callback) => {
			if (callback instanceof Function) {
				queueMicrotask(() => callback());
			}
		}),
	};
});
