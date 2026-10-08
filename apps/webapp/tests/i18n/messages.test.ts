/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

import ar from "@/i18n/messages/ar.json";
import en from "@/i18n/messages/en.json";

type MessageCatalog = { [key: string]: MessageCatalog | string };

const flattenEntries = (obj: MessageCatalog, prefix = ""): Array<[string, string]> =>
	Object.entries(obj).flatMap(([key, value]): Array<[string, string]> => {
		const path = prefix ? `${prefix}.${key}` : key;

		return value instanceof Object ? flattenEntries(value, path) : [[path, value]];
	});

describe("message catalog parity", () => {
	const enEntries = new Map(flattenEntries(en));
	const arEntries = new Map(flattenEntries(ar));

	it("every English key has an Arabic counterpart", () => {
		const missing = [...enEntries.keys()].filter((key) => !arEntries.has(key));
		expect(missing).toEqual([]);
	});

	it("Arabic has no keys missing from English", () => {
		const extra = [...arEntries.keys()].filter((key) => !enEntries.has(key));
		expect(extra).toEqual([]);
	});

	it("keeps ICU argument names identical between languages", () => {
		const argumentNames = (message: string) =>
			[...new Set([...message.matchAll(/\{\s*([A-Za-z0-9_]+)\s*[,}]/g)].map((match) => match[1]))].sort();

		const mismatches = [...enEntries].flatMap(([key, message]) => {
			const arMessage = arEntries.get(key);

			if (arMessage === undefined) {
				return [];
			}

			const ar = argumentNames(arMessage);
			const en = argumentNames(message);

			return ar.join() === en.join() ? [] : [{ ar, en, key }];
		});

		expect(mismatches).toEqual([]);
	});
});
