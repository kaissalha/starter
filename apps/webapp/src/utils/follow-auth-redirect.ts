import { z } from "zod";

const authRedirectSchema = z.compile(
	z.object({
		redirect: z.literal(true),
		url: z.string().min(1),
	})
);

type AuthRedirectCandidate = Parameters<typeof authRedirectSchema.safeParse>[0];

export const followAuthRedirect = (data: AuthRedirectCandidate): boolean => {
	const result = authRedirectSchema.safeParse(data);

	if (!result.success) {
		return false;
	}

	window.location.assign(result.data.url);

	return true;
};
