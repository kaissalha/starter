import { beforeEach, describe, expect, it, vi } from "vitest";

import { hasOwnershipTxt, inspectPublicDns } from "../../src/services/websites/domain-dns";

const missing = () => Object.assign(new Error("missing"), { code: "ENODATA" });

const mocks = vi.hoisted(() => ({
	resolve4: vi.fn(),
	resolve6: vi.fn(),
	resolveCaa: vi.fn(),
	resolveCname: vi.fn(),
	resolveTxt: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({
	Resolver: class {
		resolve4 = mocks.resolve4;
		resolve6 = mocks.resolve6;
		resolveCaa = mocks.resolveCaa;
		resolveCname = mocks.resolveCname;
		resolveTxt = mocks.resolveTxt;
		setServers = vi.fn();
	},
}));

beforeEach(() => {
	vi.clearAllMocks();

	for (const mock of Object.values(mocks)) {
		mock.mockRejectedValue(missing());
	}
});

describe("public DNS inspection", () => {
	it("matches ownership TXT records split across chunks", async () => {
		mocks.resolveTxt.mockResolvedValue([["abc", "123"]]);
		expect(await hasOwnershipTxt({ hostname: "example.com", token: "abc123" })).toBe(true);
		expect(mocks.resolveTxt).toHaveBeenCalledWith("_starter-verification.example.com");
	});
	it("reports ready records, stale records to remove, and blocking CAA", async () => {
		mocks.resolve4.mockResolvedValue(["76.76.21.21", "192.0.2.10"]);
		mocks.resolve6.mockResolvedValue(["2001:db8::1"]);
		mocks.resolveTxt.mockResolvedValue([["token"]]);
		mocks.resolveCaa.mockResolvedValue([{ critical: 0, issue: "digicert.com" }]);

		const result = await inspectPublicDns({
			expected: [
				{ name: "_starter-verification.example.com", type: "TXT", value: "token" },
				{ name: "example.com", type: "A", value: "76.76.21.21" },
			],
			hostname: "example.com",
		});

		expect(result.records.map((record) => record.ready)).toEqual([true, true]);
		expect(result.conflicts).toEqual([
			{ name: "example.com", ready: false, type: "A", value: "192.0.2.10" },
			{ name: "example.com", ready: false, type: "AAAA", value: "2001:db8::1" },
		]);
		expect(result.caaBlocked).toBe(true);
	});
	it("treats a matching CNAME as complete and ignores the addresses behind it", async () => {
		mocks.resolveCname.mockResolvedValue(["cname.vercel-dns.com."]);
		mocks.resolve4.mockResolvedValue(["76.76.21.21"]);
		mocks.resolveCaa.mockResolvedValue([{ critical: 0, issue: "letsencrypt.org" }]);

		const result = await inspectPublicDns({
			expected: [{ name: "www.example.com", type: "CNAME", value: "cname.vercel-dns.com" }],
			hostname: "www.example.com",
		});

		expect(result).toEqual({
			caaBlocked: false,
			conflicts: [],
			records: [{ name: "www.example.com", ready: true, type: "CNAME", value: "cname.vercel-dns.com" }],
		});
	});
	it("propagates resolver failures that are not missing records", async () => {
		mocks.resolveTxt.mockRejectedValue(Object.assign(new Error("timeout"), { code: "ETIMEOUT" }));
		await expect(hasOwnershipTxt({ hostname: "example.com", token: "token" })).rejects.toThrow("timeout");
	});
});
