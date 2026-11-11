import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  name: text("name"),
  message: text("message"),
  imageKey: text("image_key").notNull(),
  hidden: boolean("hidden").default(false).notNull(),
});

export type Post = typeof posts.$inferSelect;

// Photos of Mommy Rebing uploaded by family in /admin; they rotate in the tribute portrait.
export const portraits = pgTable("portraits", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  imageKey: text("image_key").notNull(),
});

export type Portrait = typeof portraits.$inferSelect;

// Admin-editable key/value settings (e.g. slideshow timing).
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
