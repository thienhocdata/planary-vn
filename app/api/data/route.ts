import { and, asc, desc, eq } from "drizzle-orm";
import { ensureDb, getDb } from "../../../db";
import { goals, habitLogs, habits, plans, tasks } from "../../../db/schema";

const starterPlans = [
  { name: "Cá nhân", color: "sage" },
  { name: "Công việc", color: "blue" },
  { name: "Sức khỏe", color: "coral" },
  { name: "Tài chính", color: "gold" },
];
const starterHabits = [
  { name: "Thức dậy đúng giờ", targetPerWeek: 6, color: "sage" },
  { name: "Vận động 30 phút", targetPerWeek: 5, color: "coral" },
  { name: "Đọc 20 trang sách", targetPerWeek: 7, color: "blue" },
  { name: "Học một kỹ năng", targetPerWeek: 5, color: "lavender" },
  { name: "Ngủ trước 23:00", targetPerWeek: 6, color: "gold" },
];

function message(error: unknown) {
  const value = error instanceof Error ? error.message : "Đã có lỗi xảy ra";
  return value.includes("no such table") ? "Kho dữ liệu chưa sẵn sàng." : value;
}

async function snapshot() {
  await ensureDb();
  const db = getDb();
  let planRows = await db.select().from(plans).orderBy(asc(plans.id));
  if (!planRows.length) planRows = await db.insert(plans).values(starterPlans).returning();
  let habitRows = await db.select().from(habits).where(eq(habits.active, true)).orderBy(asc(habits.id));
  if (!habitRows.length) {
    habitRows = await db.insert(habits).values(starterHabits.map((habit, index) => ({ ...habit, planId: planRows[index === 1 || index === 4 ? 2 : index === 2 || index === 3 ? 1 : 3]?.id || null }))).returning();
  }
  const [taskRows, goalRows, logRows] = await Promise.all([
    db.select().from(tasks).orderBy(asc(tasks.completed), asc(tasks.dueDate), desc(tasks.id)),
    db.select().from(goals).orderBy(asc(goals.status), asc(goals.targetDate), desc(goals.id)),
    db.select().from(habitLogs).orderBy(asc(habitLogs.logDate)),
  ]);
  return { plans: planRows, tasks: taskRows, goals: goalRows, habits: habitRows, habitLogs: logRows };
}

export async function GET() {
  try { return Response.json(await snapshot()); }
  catch (error) { return Response.json({ error: message(error) }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    await ensureDb();
    const body = (await request.json()) as Record<string, unknown> & { type?: string };
    const db = getDb();
    if (body.type === "plan") {
      const name = String(body.name || "").trim();
      if (!name) return Response.json({ error: "Tên kế hoạch là bắt buộc." }, { status: 400 });
      const [plan] = await db.insert(plans).values({ name, color: String(body.color || "lavender") }).returning();
      return Response.json({ plan }, { status: 201 });
    }
    if (body.type === "goal") {
      const title = String(body.title || "").trim();
      if (!title) return Response.json({ error: "Tên mục tiêu là bắt buộc." }, { status: 400 });
      const [goal] = await db.insert(goals).values({ title, planId: Number(body.planId) || null, targetDate: String(body.targetDate || "") || null }).returning();
      return Response.json({ goal }, { status: 201 });
    }
    if (body.type === "habit") {
      const name = String(body.name || "").trim();
      if (!name) return Response.json({ error: "Tên thói quen là bắt buộc." }, { status: 400 });
      const [habit] = await db.insert(habits).values({ name, planId: Number(body.planId) || null, targetPerWeek: Math.min(7, Math.max(1, Number(body.targetPerWeek) || 5)), color: String(body.color || "sage") }).returning();
      return Response.json({ habit }, { status: 201 });
    }
    if (body.type === "habitLog") {
      const habitId = Number(body.habitId); const logDate = String(body.logDate || "");
      if (!habitId || !/^\d{4}-\d{2}-\d{2}$/.test(logDate)) return Response.json({ error: "Lần check-in không hợp lệ." }, { status: 400 });
      const [existing] = await db.select().from(habitLogs).where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.logDate, logDate))).limit(1);
      if (existing) { await db.delete(habitLogs).where(eq(habitLogs.id, existing.id)); return Response.json({ completed: false, habitId, logDate }); }
      const [log] = await db.insert(habitLogs).values({ habitId, logDate }).returning();
      return Response.json({ completed: true, log });
    }
    const title = String(body.title || "").trim();
    if (!title) return Response.json({ error: "Nội dung công việc là bắt buộc." }, { status: 400 });
    const [task] = await db.insert(tasks).values({ title, note: String(body.note || "").trim(), dueDate: String(body.dueDate || "") || null, planId: Number(body.planId) || null, priority: String(body.priority || "normal") }).returning();
    return Response.json({ task }, { status: 201 });
  } catch (error) { return Response.json({ error: message(error) }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  try {
    await ensureDb();
    const body = (await request.json()) as { type?: string; id?: number; completed?: boolean; progress?: number };
    if (!body.id) return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
    const db = getDb();
    if (body.type === "goal") {
      const progress = Math.min(100, Math.max(0, Number(body.progress) || 0));
      const [goal] = await db.update(goals).set({ progress, status: progress === 100 ? "done" : "active" }).where(eq(goals.id, body.id)).returning();
      return Response.json({ goal });
    }
    if (typeof body.completed !== "boolean") return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
    const [task] = await db.update(tasks).set({ completed: body.completed }).where(eq(tasks.id, body.id)).returning();
    return Response.json({ task });
  } catch (error) { return Response.json({ error: message(error) }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    await ensureDb();
    const url = new URL(request.url); const id = Number(url.searchParams.get("id")); const kind = url.searchParams.get("kind") || "task";
    if (!id) return Response.json({ error: "Thiếu mã dữ liệu." }, { status: 400 });
    const db = getDb();
    if (kind === "habit") await db.delete(habits).where(eq(habits.id, id));
    else if (kind === "goal") await db.delete(goals).where(eq(goals.id, id));
    else await db.delete(tasks).where(eq(tasks.id, id));
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ error: message(error) }, { status: 500 }); }
}
