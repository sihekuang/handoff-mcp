// TEMPORARY placeholder. Replaced in Task 2.2 by `@better-auth/cli generate`.
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id:        text("id").primaryKey(),
  email:     text("email").notNull().unique(),
  name:      text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
