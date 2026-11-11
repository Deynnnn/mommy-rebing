import { sql } from "drizzle-orm";
import { boolean, doublePrecision, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  name: text("name"),
  message: text("message"),
  imageKey: text("image_key").notNull(),
  hidden: boolean("hidden").default(false).notNull(),
  /** "image" or "video". imageKey holds the bucket key for either. */
  mediaType: text("media_type").default("image").notNull(),
  /** Display order (ascending). New uploads get the current epoch ms, so they land at the end. */
  sortOrder: doublePrecision("sort_order")
    .default(sql`(extract(epoch from clock_timestamp()) * 1000)`)
    .notNull(),
});

export type Post = typeof posts.$inferSelect;

// Photos of Mommy Rebing uploaded by family in /admin; they rotate in the tribute portrait.
export const portraits = pgTable("portraits", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  imageKey: text("image_key").notNull(),
});

export type Portrait = typeof portraits.$inferSelect;

// Background music for the TV slideshow, uploaded by admins; plays in sortOrder.
export const tracks = pgTable("tracks", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  title: text("title").notNull(),
  audioKey: text("audio_key").notNull(),
  sortOrder: doublePrecision("sort_order")
    .default(sql`(extract(epoch from clock_timestamp()) * 1000)`)
    .notNull(),
});

export type Track = typeof tracks.$inferSelect;

// Admin-editable key/value settings (e.g. slideshow timing).
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
