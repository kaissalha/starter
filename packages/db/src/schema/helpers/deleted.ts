import { text, timestamp } from "drizzle-orm/pg-core";

import { users } from "../auth/users";

export const deletedFields = {
	deletedAt: timestamp("deleted_at", { mode: "string", withTimezone: true }),
	deletedBy: text("deleted_by").references(() => users.id, { onDelete: "cascade" }),
};
