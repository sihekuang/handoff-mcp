import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { user } from "@/lib/auth/schema";

export const handoffStatus = pgEnum("handoff_status", ["open", "in_progress", "done"]);

export type HandoffMetadata = {
  git?: { repo?: string; branch?: string; commit?: string; prUrl?: string };
  files?: Array<{ path: string; note?: string }>;
  [k: string]: unknown;
};

export const handoffs = pgTable("handoffs", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  title:     text("title").notNull(),
  summary:   text("summary"),
  body:      text("body").notNull(),
  status:    handoffStatus("status").notNull().default("open"),
  project:   text("project"),
  tags:      text("tags").array().notNull().default(sql`'{}'::text[]`),
  metadata:  jsonb("metadata").$type<HandoffMetadata>().notNull().default({}),
  claimedBy: text("claimed_by"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byUser:    index("handoffs_by_user").on(t.userId, t.status, t.updatedAt),
  byProject: index("handoffs_by_project").on(t.userId, t.project),
}));

export type Handoff = typeof handoffs.$inferSelect;
export type HandoffInsert = typeof handoffs.$inferInsert;
export type HandoffStatus = "open" | "in_progress" | "done";

// --- zod schemas (shared by REST + MCP) ---

const metadataSchema = z.object({
  git: z.object({
    repo: z.string().optional(),
    branch: z.string().optional(),
    commit: z.string().optional(),
    prUrl: z.string().url().optional(),
  }).optional(),
  files: z.array(z.object({ path: z.string(), note: z.string().optional() })).optional(),
}).catchall(z.unknown());

export const createHandoffInput = z.object({
  title:    z.string().min(1).max(200),
  body:     z.string().min(1).max(200_000),
  summary:  z.string().max(500).optional(),
  status:   z.enum(["open", "in_progress", "done"]).default("open"),
  project:  z.string().max(100).optional(),
  tags:     z.array(z.string().max(50)).max(20).default([]),
  metadata: metadataSchema.default({}),
});
export type CreateHandoffInput = z.infer<typeof createHandoffInput>;

export const listHandoffsInput = z.object({
  status:  z.enum(["open", "in_progress", "done"]).optional(),
  project: z.string().optional(),
  tag:     z.string().optional(),
  claimed: z.boolean().optional(),
  query:   z.string().optional(),
  limit:   z.number().int().min(1).max(100).default(25),
  cursor:  z.string().optional(),
});
export type ListHandoffsInput = z.infer<typeof listHandoffsInput>;

export const updateHandoffInput = z.object({
  id: z.string(),
  patch: z.object({
    title:    z.string().min(1).max(200).optional(),
    body:     z.string().min(1).max(200_000).optional(),
    summary:  z.string().max(500).nullable().optional(),
    status:   z.enum(["open", "in_progress", "done"]).optional(),
    project:  z.string().max(100).nullable().optional(),
    tags:     z.array(z.string().max(50)).max(20).optional(),
    metadata: metadataSchema.optional(),
  }),
});
export type UpdateHandoffInput = z.infer<typeof updateHandoffInput>;

export const claimHandoffInput = z.object({
  id:    z.string(),
  agent: z.string().min(1).max(80),
});
export type ClaimHandoffInput = z.infer<typeof claimHandoffInput>;
