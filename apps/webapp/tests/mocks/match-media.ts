import { vi } from "vitest";

const mockMatchMedia = vi.fn().mockImplementation((query) => ({
	addEventListener: vi.fn(),
	addListener: vi.fn(),
	dispatchEvent: vi.fn(),
	matches: false,
	media: query,
	onchange: null,
	removeEventListener: vi.fn(),
	removeListener: vi.fn(),
}));

vi.stubGlobal("matchMedia", mockMatchMedia);
