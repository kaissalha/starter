import { z } from "zod";

type AskUserQuestionsOutput = {
	answers?: Array<{
		otherText?: string;
		question: string;
		questionId: string;
		selectedOptions?: Array<string>;
		skipped?: boolean;
	}>;
	dismissed?: boolean;
};

export const askUserQuestionsOutputSchema: z.ZodType<AskUserQuestionsOutput> = z.compile(
	z.object({
		answers: z
			.array(
				z.object({
					otherText: z.string().optional(),
					question: z.string(),
					questionId: z.string(),
					selectedOptions: z.array(z.string()).optional(),
					skipped: z.boolean().optional(),
				})
			)
			.optional(),
		dismissed: z.boolean().optional(),
	})
);
