import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	activate: vi.fn(),
	check: vi.fn(),
	fail: vi.fn(),
	sleep: vi.fn(async () => undefined),
	submit: vi.fn(),
}));

vi.mock("workflow", () => ({ FatalError: class extends Error {}, sleep: mocks.sleep }));

vi.mock("../../src/services/websites/domain-registrations", () => ({
	activateDomainRegistration: mocks.activate,
	checkDomainRegistrationOrder: mocks.check,
	failDomainRegistration: mocks.fail,
	submitDomainRegistrationOrder: mocks.submit,
}));

import { registerDomainWorkflow } from "../../src/workflows/register-domain";

beforeEach(() => {
	vi.clearAllMocks();
	mocks.submit.mockResolvedValue("order-1");
});

describe("registerDomainWorkflow", () => {
	it("polls the order and activates the registration once it completes", async () => {
		mocks.check.mockResolvedValueOnce("pending").mockResolvedValueOnce("completed");
		await registerDomainWorkflow("registration-1");
		expect(mocks.check).toHaveBeenCalledTimes(2);
		expect(mocks.sleep).toHaveBeenCalledWith("15s");
		expect(mocks.activate).toHaveBeenCalledWith("registration-1");
		expect(mocks.fail).not.toHaveBeenCalled();
	});
	it("marks failed orders without activating", async () => {
		mocks.check.mockResolvedValue("failed");
		await registerDomainWorkflow("registration-1");
		expect(mocks.fail).toHaveBeenCalledWith({ code: "ORDER_FAILED", registrationId: "registration-1" });
		expect(mocks.activate).not.toHaveBeenCalled();
	});
	it("records a rejected order and never polls", async () => {
		mocks.submit.mockRejectedValue(new Error("price mismatch"));
		await expect(registerDomainWorkflow("registration-1")).rejects.toThrow("price mismatch");
		expect(mocks.fail).toHaveBeenCalledWith({ code: "ORDER_REJECTED", registrationId: "registration-1" });
		expect(mocks.check).not.toHaveBeenCalled();
	});
	it("stops when the registration is no longer pending", async () => {
		mocks.submit.mockResolvedValue(null);
		await expect(registerDomainWorkflow("registration-1")).rejects.toThrow("no longer pending");
		expect(mocks.check).not.toHaveBeenCalled();
	});
});
