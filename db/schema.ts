import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash"),
  passwordSalt: text("password_salt"),
  passwordIterations: integer("password_iterations").notNull().default(100000),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const authIdentities = sqliteTable(
  "auth_identities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_auth_identities_provider_account").on(table.provider, table.providerAccountId),
    index("idx_auth_identities_user_id").on(table.userId),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_sessions_user_id_expires_at").on(table.userId, table.expiresAt)],
);

export const oauthStates = sqliteTable(
  "oauth_states",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    stateHash: text("state_hash").notNull().unique(),
    provider: text("provider").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_oauth_states_provider_expires_at").on(table.provider, table.expiresAt)],
);

export const plans = sqliteTable("plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("sage"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const tasks = sqliteTable(
  "tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
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
    index("idx_tasks_user_completed_due_date").on(table.userId, table.completed, table.dueDate),
  ],
);

export const goals = sqliteTable(
  "goals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    planId: integer("plan_id").references(() => plans.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    targetDate: text("target_date"),
    progress: integer("progress").notNull().default(0),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_goals_user_status").on(table.userId, table.status)],
);

export const habits = sqliteTable(
  "habits",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    planId: integer("plan_id").references(() => plans.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    targetPerWeek: integer("target_per_week").notNull().default(5),
    color: text("color").notNull().default("sage"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_habits_user_active").on(table.userId, table.active)],
);

export const habitLogs = sqliteTable(
  "habit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    habitId: integer("habit_id").notNull().references(() => habits.id, { onDelete: "cascade" }),
    logDate: text("log_date").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_habit_logs_user_habit_date").on(table.userId, table.habitId, table.logDate),
    index("idx_habit_logs_user_date").on(table.userId, table.logDate),
  ],
);

export const weeklyReviews = sqliteTable(
  "weekly_reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    weekStart: text("week_start").notNull(),
    wins: text("wins").notNull().default(""),
    blockers: text("blockers").notNull().default(""),
    lessons: text("lessons").notNull().default(""),
    nextFocus: text("next_focus").notNull().default(""),
    energy: integer("energy").notNull().default(3),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("idx_weekly_reviews_user_week_start").on(table.userId, table.weekStart)],
);

export const dayNotes = sqliteTable(
  "day_notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    noteDate: text("note_date").notNull(),
    content: text("content").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("idx_day_notes_user_date").on(table.userId, table.noteDate)],
);
