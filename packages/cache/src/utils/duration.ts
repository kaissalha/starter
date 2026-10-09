type DurationUnit = "d" | "h" | "m" | "ms" | "s";

export type Duration = `${number} ${DurationUnit}` | `${number}${DurationUnit}`;

const unitMilliseconds = new Map(
	Object.entries({ d: 86_400_000, h: 3_600_000, m: 60_000, ms: 1, s: 1000 } satisfies Record<DurationUnit, number>)
);

export const toMilliseconds = (duration: Duration) => {
	const [, amount, unit = ""] = duration.match(/^(\d+(?:\.\d+)?)\s?(ms|s|m|h|d)$/u) ?? [];
	const milliseconds = Number(amount) * (unitMilliseconds.get(unit) ?? Number.NaN);

	if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
		throw new Error(`Invalid duration: ${duration}`);
	}

	return Math.ceil(milliseconds);
};
