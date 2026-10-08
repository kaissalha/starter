import { log } from "evlog";

export const assertRequiredConfig = async ({
	app,
	enforce,
	names,
}: {
	app: string;
	enforce: boolean;
	names: ReadonlyArray<string>;
}) => {
	const missing = names.filter((name) => !process.env[name]?.trim());

	if (missing.length === 0) {
		return;
	}

	const production = process.env.VERCEL_ENV === "production";
	await log[production ? "error" : "warn"]({ app, message: "Required production configuration is not set", missing });

	if (production && enforce) {
		throw new Error(`Missing required configuration for ${app}: ${missing.join(", ")}`);
	}
};
