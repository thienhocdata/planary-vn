import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export const goals = sqliteTable(
  "goals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    planId: integer("plan_id").references(() => plans.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    targetDate: text("target_date"),
    progress: integer("progress").notNull().default(0),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_goals_plan_id_status").on(table.planId, table.status)],
);

export const habits = sqliteTable(
  "habits",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    planId: integer("plan_id").references(() => plans.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    targetPerWeek: integer("target_per_week").notNull().default(5),
    color: text("color").notNull().default("sage"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_habits_active").on(table.active)],
);

export const habitLogs = sqliteTable(
  "habit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    habitId: integer("habit_id").notNull().references(() => habits.id, { onDelete: "cascade" }),
    logDate: text("log_date").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_habit_logs_habit_date").on(table.habitId, table.logDate),
    index("idx_habit_logs_date").on(table.logDate),
  ],
);

export const weeklyReviews = sqliteTable(
  "weekly_reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    weekStart: text("week_start").notNull(),
    wins: text("wins").notNull().default(""),
    blockers: text("blockers").notNull().default(""),
    lessons: text("lessons").notNull().default(""),
    nextFocus: text("next_focus").notNull().default(""),
    energy: integer("energy").notNull().default(3),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("idx_weekly_reviews_week_start").on(table.weekStart)],
);
