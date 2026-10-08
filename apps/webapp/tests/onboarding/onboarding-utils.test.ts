import { describe, expect, it } from "vitest";

import {
	buildOrganizationSlug,
	getOnboardingRedirectPath,
} from "@/app/[locale]/onboarding/components/onboarding-utils";

describe("onboarding utils", () => {
	describe("getOnboardingRedirectPath", () => {
		it("defaults to the dashboard when no redirect is provided", () => {
			expect(getOnboardingRedirectPath({ redirectUrl: undefined })).toBe("/dashboard");
		});

		it("strips the locale prefix from internal redirect paths", () => {
			expect(getOnboardingRedirectPath({ redirectUrl: "/en/dashboard/chat?view=all" })).toBe(
				"/dashboard/chat?view=all"
			);
		});

		it("rejects auth and onboarding routes", () => {
			expect(getOnboardingRedirectPath({ redirectUrl: "/login" })).toBe("/dashboard");
			expect(getOnboardingRedirectPath({ redirectUrl: "/onboarding" })).toBe("/dashboard");
		});

		it("rejects external-style redirects", () => {
			expect(getOnboardingRedirectPath({ redirectUrl: "//evil.example.com" })).toBe("/dashboard");
		});
	});

	describe("buildOrganizationSlug", () => {
		it("normalizes organization names into URL-safe slugs", () => {
			expect(buildOrganizationSlug({ name: "Clinique Santé +" })).toBe("clinique-sante");
		});

		it("falls back when the name has no slug-safe characters", () => {
			expect(buildOrganizationSlug({ name: "!!!" })).toBe("organization");
		});

		it("appends an optional suffix", () => {
			expect(buildOrganizationSlug({ name: "Acme Clinic", suffix: "abc123" })).toBe("acme-clinic-abc123");
		});
	});
});
