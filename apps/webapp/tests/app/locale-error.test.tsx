import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import RouteError from "@/app/[locale]/error";

import { mockPostHogClient } from "../mocks/posthog";

const digestError = Object.assign(new Error("render failed"), { digest: "abc" });

describe("route error boundary", () => {
	it("reports each distinct error once", () => {
		const { rerender } = render(<RouteError error={digestError} retry={vi.fn()} />);
		expect(mockPostHogClient.captureException).toHaveBeenCalledOnce();
		expect(mockPostHogClient.captureException).toHaveBeenCalledWith(digestError, { digest: "abc" });

		rerender(<RouteError error={digestError} retry={vi.fn()} />);
		expect(mockPostHogClient.captureException).toHaveBeenCalledOnce();

		const other = new Error("other");
		rerender(<RouteError error={other} retry={vi.fn()} />);
		expect(mockPostHogClient.captureException).toHaveBeenCalledTimes(2);
		expect(mockPostHogClient.captureException).toHaveBeenLastCalledWith(other, { digest: undefined });
	});
});
