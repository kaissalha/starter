import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, pool, websites } from "../src";

const [target, ...rest] = process.argv.slice(2);

const restore = rest[0] === "--restore";

const reason = rest.join(" ").trim();

if (!target || (!restore && !reason)) {
	console.error("Usage: set-website-suspension.ts <websiteId|subdomain> <reason | --restore>");
	process.exitCode = 1;
} else {
	try {
		const updated = await db
			.update(websites)
			.set(
				restore
					? { suspendedAt: null, suspensionReason: null }
					: { suspendedAt: new Date().toISOString(), suspensionReason: reason }
			)
			.where(z.uuid().safeParse(target).success ? eq(websites.id, target) : eq(websites.subdomain, target))
			.returning({ id: websites.id });

		if (updated.length === 0) {
			process.stdout.write("not found\n");
			process.exitCode = 1;
		} else {
			process.stdout.write(`${restore ? "restored" : "suspended"} ${updated.map(({ id }) => id).join(", ")}\n`);
		}
	} finally {
		await pool.end();
	}
}
