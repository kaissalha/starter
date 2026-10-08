import { z } from "zod";

export const PaginationSchema = z.compile(
	z.object({
		cursor: z.string().nullable().optional(),
		order: z.enum(["asc", "desc"]).optional(),
		pageSize: z.number().optional(),
		sort: z.string().optional(),
	})
);

export type PaginationProps = z.infer<typeof PaginationSchema>;

export type PaginatedData<T> = {
	cursor: string | null;
	data: Array<T>;
	totalData: number;
	totalPages: number;
};
