import { vi } from "vitest";

const mockPostHogClient = {
	capture: vi.fn(),
	captureException: vi.fn(),
	group: vi.fn(),
	identify: vi.fn(),
	init: vi.fn(),
	reset: vi.fn(),
	set_config: vi.fn(),
};

export const mockUsePostHog = vi.fn(() => mockPostHogClient);

export const mockPostHogMiddleware = vi.fn(({ response }: { response?: unknown } = {}) => {
	return vi.fn(async () => response);
});

export const mockCreateOnRequestError = vi.fn(() => vi.fn());

vi.mock("@posthog/next", () => ({
	createOnRequestError: mockCreateOnRequestError,
	PostHogFeature: ({ children }: { children: React.ReactNode }) => children,
	postHogMiddleware: mockPostHogMiddleware,
	PostHogPageView: () => null,
	PostHogProvider: ({ children }: { children: React.ReactNode }) => children,
	useActiveFeatureFlags: vi.fn(() => []),
	useFeatureFlag: vi.fn(() => false),
	usePostHog: mockUsePostHog,
}));

vi.mock("@/lib/posthog", () => ({
	PostHogClientEffects: () => null,
	PostHogIdentify: () => null,
}));

export { mockPostHogClient };
