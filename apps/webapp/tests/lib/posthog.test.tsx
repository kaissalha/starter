import { createContext, use } from "react";

import { render } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { mockPostHogClient } from "../mocks/posthog";

const auth = vi.hoisted(() => ({ useAuthSession: vi.fn() }));

vi.mock("@/components/auth/auth-session-context", () => auth);

vi.doUnmock("@/lib/posthog");

const { PostHogClientEffects, PostHogIdentify } = await import("@/lib/posthog");

const user = { email: "owner@example.com", id: "user-1", name: "Owner" };

const SessionContext = createContext<{ data: { user: typeof user } | null }>({ data: null });

const withSession = (data: { user: typeof user } | null) => (
	<SessionContext value={{ data }}>
		<PostHogIdentify />
	</SessionContext>
);

beforeEach(() => {
	auth.useAuthSession.mockImplementation(() => use(SessionContext));
});

it("identifies a user once per session and resets after sign-out", () => {
	const { rerender } = render(withSession({ user }));
	rerender(withSession({ user: { ...user } }));
	expect(mockPostHogClient.identify).toHaveBeenCalledOnce();
	expect(mockPostHogClient.identify).toHaveBeenCalledWith("user-1", { email: "owner@example.com", name: "Owner" });

	rerender(withSession(null));
	expect(mockPostHogClient.reset).toHaveBeenCalledOnce();
});

it("does nothing for anonymous visitors", () => {
	const { rerender } = render(withSession(null));
	rerender(withSession(null));
	expect(mockPostHogClient.identify).not.toHaveBeenCalled();
	expect(mockPostHogClient.reset).not.toHaveBeenCalled();
});

it("filters ResizeObserver noise without reading the session", () => {
	render(<PostHogClientEffects />);
	const [[{ before_send: beforeSend }]] = mockPostHogClient.set_config.mock.calls;
	const exception = (value: string) => ({ event: "$exception", properties: { $exception_list: [{ value }] } });
	expect(beforeSend(exception("ResizeObserver loop completed with undelivered notifications."))).toBeNull();
	expect(beforeSend(exception("Boom"))).toEqual(exception("Boom"));
	expect(auth.useAuthSession).not.toHaveBeenCalled();
});
