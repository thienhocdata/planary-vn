import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

async function hasColumn(d1: D1Database, table: string, column: string) {
  const result = await d1.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  return result.results.some((item) => item.name === column);
}

async function addUserColumn(d1: D1Database, table: string) {
  if (!await hasColumn(d1, table, "user_id")) {
    await d1.prepare(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`).run();
  }
}

async function addPasswordIterationColumn(d1: D1Database) {
  if (!await hasColumn(d1, "users", "password_iterations")) {
    await d1.prepare("ALTER TABLE users ADD COLUMN password_iterations INTEGER NOT NULL DEFAULT 100000").run();
  }
}

async function addTaskSortOrderColumn(d1: D1Database) {
  if (!await hasColumn(d1, "tasks", "sort_order")) {
    await d1.prepare("ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0").run();
  }
}

async function addTaskTimeSlotColumn(d1: D1Database) {
  if (!await hasColumn(d1, "tasks", "time_slot")) {
    await d1.prepare("ALTER TABLE tasks ADD COLUMN time_slot TEXT NOT NULL DEFAULT 'morning'").run();
  }
}

export async function ensureDb() {
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  const d1 = env.DB;
  await d1.batch([
    d1.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT,
      password_salt TEXT,
      password_iterations INTEGER NOT NULL DEFAULT 100000,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS auth_identities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_identities_provider_account ON auth_identities(provider, provider_account_id)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_auth_identities_user_id ON auth_identities(user_id)"),
    d1.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_sessions_user_id_expires_at ON sessions(user_id, expires_at)"),
    d1.prepare(`CREATE TABLE IF NOT EXISTS oauth_states (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      state_hash TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_oauth_states_provider_expires_at ON oauth_states(provider, expires_at)"),
    d1.prepare(`CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'sage',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      due_date TEXT,
      priority TEXT NOT NULL DEFAULT 'normal',
      time_slot TEXT NOT NULL DEFAULT 'morning',
      sort_order INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_tasks_plan_id ON tasks(plan_id)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_tasks_completed_due_date ON tasks(completed, due_date)"),
    d1.prepare(`CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      target_date TEXT,
      progress INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_goals_plan_id_status ON goals(plan_id, status)"),
    d1.prepare(`CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      target_per_week INTEGER NOT NULL DEFAULT 5,
      color TEXT NOT NULL DEFAULT 'sage',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_habits_active ON habits(active)"),
    d1.prepare(`CREATE TABLE IF NOT EXISTS habit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
      log_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_habit_logs_habit_date ON habit_logs(habit_id, log_date)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(log_date)"),
    d1.prepare(`CREATE TABLE IF NOT EXISTS weekly_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      week_start TEXT NOT NULL,
      wins TEXT NOT NULL DEFAULT '',
      blockers TEXT NOT NULL DEFAULT '',
      lessons TEXT NOT NULL DEFAULT '',
      next_focus TEXT NOT NULL DEFAULT '',
      energy INTEGER NOT NULL DEFAULT 3,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS day_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      note_date TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
  ]);
  await Promise.all(["plans", "tasks", "goals", "habits", "habit_logs", "weekly_reviews", "day_notes"].map((table) => addUserColumn(d1, table)));
  await addPasswordIterationColumn(d1);
  await addTaskSortOrderColumn(d1);
  await addTaskTimeSlotColumn(d1);
  await d1.batch([
    d1.prepare("DROP INDEX IF EXISTS idx_tasks_user_completed_due_date"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_tasks_user_completed_due_date ON tasks(user_id, completed, due_date, time_slot, sort_order)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_habits_user_active ON habits(user_id, active)"),
    d1.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_habit_logs_user_habit_date ON habit_logs(user_id, habit_id, log_date)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON habit_logs(user_id, log_date)"),
    d1.prepare("DROP INDEX IF EXISTS idx_weekly_reviews_week_start"),
    d1.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_reviews_user_week_start ON weekly_reviews(user_id, week_start)"),
    d1.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_day_notes_user_date ON day_notes(user_id, note_date)"),
  ]);
  await d1.prepare("PRAGMA optimize").run();
}
