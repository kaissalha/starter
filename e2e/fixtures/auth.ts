import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { testUtils } from "better-auth/plugins";
import { emailOTP } from "better-auth/plugins/email-otp";

import { db, schema } from "@starter/db";

const issuedOTPs = new Map<string, string>();

const testAuth = betterAuth({
	baseURL: "http://localhost:3100",
	database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
	plugins: [
		emailOTP({
			sendVerificationOTP: async ({ email, otp }) => {
				issuedOTPs.set(email, otp);
			},
			storeOTP: "hashed",
		}),
		testUtils(),
	],
});

export const issueSignInOTP = async (email: string) => {
	await testAuth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
	const otp = issuedOTPs.get(email);

	if (!otp) {
		throw new Error(`No OTP was issued for ${email}`);
	}

	return otp;
};

export const deleteUserByEmail = async (email: string) => {
	const context = await testAuth.$context;
	const found = await context.internalAdapter.findUserByEmail(email);

	if (found) {
		await context.test.deleteUser(found.user.id);
	}
};
