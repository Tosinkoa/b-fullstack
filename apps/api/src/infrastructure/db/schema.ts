import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const deploymentStatusEnum = pgEnum("deployment_status", [
  "pending",
  "building",
  "deploying",
  "running",
  "failed",
]);

export const deploymentSourceTypeEnum = pgEnum("deployment_source_type", [
  "git",
  "upload",
]);

export const deployments = pgTable("deployments", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),

  sourceType: deploymentSourceTypeEnum("source_type").notNull(),
  sourceUrl: text("source_url"),

  status: deploymentStatusEnum("status").notNull().default("pending"),

  imageTag: text("image_tag"),
  routePath: text("route_path"),
  liveUrl: text("live_url"),
  lastError: text("last_error"),
});

export const deploymentLogStreamEnum = pgEnum("deployment_log_stream", [
  "stdout",
  "stderr",
  "system",
]);

export const deploymentLogs = pgTable("deployment_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  deploymentId: uuid("deployment_id")
    .notNull()
    .references(() => deployments.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  stream: deploymentLogStreamEnum("stream").notNull(),
  message: text("message").notNull(),
});
