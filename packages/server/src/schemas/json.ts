import { z } from "zod";

export const jsonValueSchema = z.json();

export const jsonRecordSchema = z.record(z.string(), jsonValueSchema);

export type JsonValue = z.infer<typeof jsonValueSchema>;

export type JsonRecord = z.infer<typeof jsonRecordSchema>;
