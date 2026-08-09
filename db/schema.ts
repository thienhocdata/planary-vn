import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const plans = sqliteTable("plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  color: text("color").notNull().default("sage"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const tasks = sqliteTable(
  "tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    planId: integer("plan_id").references(() => plans.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    note: text("note").notNull().default(""),
    dueDate: text("due_date"),
    priority: text("priority").notNull().default("normal"),
    completed: integer("completed", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_tasks_plan_id").on(table.planId),
    index("idx_tasks_completed_due_date").on(table.completed, table.dueDate),
  ],
);
