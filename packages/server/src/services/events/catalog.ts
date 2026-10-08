import type { z } from "zod";

import type { EventData } from "@starter/db";

export const eventCatalog: Record<string, { data: z.ZodType<EventData>; subjectType: string }> = {};

export type EventType = keyof typeof eventCatalog;

export type EventDataFor<Type extends EventType> = z.infer<(typeof eventCatalog)[Type]["data"]>;

export const isEventType = (type: string): type is EventType => type in eventCatalog;
