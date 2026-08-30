import { and, asc, desc, eq, inArray, max } from "drizzle-orm";
import { getCurrentUser } from "../../../db/auth";
import { ensureDb, getDb } from "../../../db";
import { dayNotes, goals, habitLogs, habits, plans, tasks, weeklyReviews } from "../../../db/schema";

const starterPlans = [
  { name: "Cá nhân", color: "sage" },
  { name: "Công việc", color: "blue" },
  { name: "Sức khỏe", color: "coral" },
  { name: "Tài chính", color: "gold" },
];
const starterHabits = [
  { name: "Thức dậy đúng giờ", targetPerWeek: 6, color: "sage", planIndex: 0 },
  { name: "Vận động 30 phút", targetPerWeek: 5, color: "coral", planIndex: 2 },
  { name: "Đọc 20 trang sách", targetPerWeek: 7, color: "blue", planIndex: 0 },
  { name: "Học một kỹ năng", targetPerWeek: 5, color: "lavender", planIndex: 1 },
  { name: "Ngủ trước 23:00", targetPerWeek: 6, color: "gold", planIndex: 2 },
];

function message(error: unknown) {
  const value = error instanceof Error ? error.message : "Đã có lỗi xảy ra";
  return value.includes("no such table") ? "Kho dữ liệu chưa sẵn sàng." : value;
}

function signedOut() {
  return Response.json({ error: "Bạn cần đăng nhập để xem không gian riêng." }, { status: 401 });
}

async function ownedPlanId(userId: number, value: unknown) {
  const planId = Number(value) || null;
  if (!planId) return null;
  const [plan] = await getDb().select({ id: plans.id }).from(plans).where(and(eq(plans.id, planId), eq(plans.userId, userId))).limit(1);
  return plan?.id || null;
}

async function nextTaskSortOrder(userId: number, dueDate: string | null) {
  if (!dueDate) return 0;
  const [last] = await getDb().select({ value: max(tasks.sortOrder) }).from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.dueDate, dueDate)));
  return (last?.value ?? -1) + 1;
}

async function snapshot(userId: number) {
  await ensureDb();
  const db = getDb();
  let planRows = await db.select().from(plans).where(eq(plans.userId, userId)).orderBy(asc(plans.id));
  if (!planRows.length) planRows = await db.insert(plans).values(starterPlans.map((plan) => ({ ...plan, userId }))).returning();
  let habitRows = await db.select().from(habits).where(and(eq(habits.userId, userId), eq(habits.active, true))).orderBy(asc(habits.id));
  if (!habitRows.length) habitRows = await db.insert(habits).values(starterHabits.map(({ planIndex, ...habit }) => ({ ...habit, userId, planId: planRows[planIndex]?.id || null }))).returning();
  const [taskRows, goalRows, logRows, reviewRows, noteRows] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(asc(tasks.completed), asc(tasks.dueDate), asc(tasks.sortOrder), desc(tasks.id)),
    db.select().from(goals).where(eq(goals.userId, userId)).orderBy(asc(goals.status), asc(goals.targetDate), desc(goals.id)),
    db.select().from(habitLogs).where(eq(habitLogs.userId, userId)).orderBy(asc(habitLogs.logDate)),
    db.select().from(weeklyReviews).where(eq(weeklyReviews.userId, userId)).orderBy(desc(weeklyReviews.weekStart)).limit(52),
    db.select().from(dayNotes).where(eq(dayNotes.userId, userId)).orderBy(desc(dayNotes.noteDate)).limit(365),
  ]);
  return { plans: planRows, tasks: taskRows, goals: goalRows, habits: habitRows, habitLogs: logRows, weeklyReviews: reviewRows, dayNotes: noteRows };
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return signedOut();
    return Response.json({ user, ...await snapshot(user.id) });
  } catch (error) { return Response.json({ error: message(error) }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return signedOut();
    const body = (await request.json()) as Record<string, unknown> & { type?: string };
    const db = getDb();
    if (body.type === "plan") {
      const name = String(body.name || "").trim();
      if (!name) return Response.json({ error: "Tên kế hoạch là bắt buộc." }, { status: 400 });
      const [plan] = await db.insert(plans).values({ userId: user.id, name, color: String(body.color || "lavender") }).returning();
      return Response.json({ plan }, { status: 201 });
    }
    if (body.type === "goal") {
      const title = String(body.title || "").trim();
      if (!title) return Response.json({ error: "Tên mục tiêu là bắt buộc." }, { status: 400 });
      const targetDate = String(body.targetDate || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return Response.json({ error: "Hãy chọn ngày đích để Planary tự tính tiến độ." }, { status: 400 });
      const [goal] = await db.insert(goals).values({ userId: user.id, title, planId: await ownedPlanId(user.id, body.planId), targetDate }).returning();
      return Response.json({ goal }, { status: 201 });
    }
    if (body.type === "habit") {
      const name = String(body.name || "").trim();
      if (!name) return Response.json({ error: "Tên thói quen là bắt buộc." }, { status: 400 });
      const [habit] = await db.insert(habits).values({ userId: user.id, name, planId: await ownedPlanId(user.id, body.planId), targetPerWeek: Math.min(7, Math.max(1, Number(body.targetPerWeek) || 5)), color: String(body.color || "sage") }).returning();
      return Response.json({ habit }, { status: 201 });
    }
    if (body.type === "habitLog") {
      const habitId = Number(body.habitId); const logDate = String(body.logDate || "");
      if (!habitId || !/^\d{4}-\d{2}-\d{2}$/.test(logDate)) return Response.json({ error: "Lần check-in không hợp lệ." }, { status: 400 });
      const [habit] = await db.select({ id: habits.id }).from(habits).where(and(eq(habits.id, habitId), eq(habits.userId, user.id))).limit(1);
      if (!habit) return Response.json({ error: "Thói quen này không thuộc không gian của bạn." }, { status: 404 });
      const [existing] = await db.select().from(habitLogs).where(and(eq(habitLogs.userId, user.id), eq(habitLogs.habitId, habitId), eq(habitLogs.logDate, logDate))).limit(1);
      if (existing) { await db.delete(habitLogs).where(and(eq(habitLogs.id, existing.id), eq(habitLogs.userId, user.id))); return Response.json({ completed: false, habitId, logDate }); }
      const [log] = await db.insert(habitLogs).values({ userId: user.id, habitId, logDate }).returning();
      return Response.json({ completed: true, log });
    }
    if (body.type === "review") {
      const weekStart = String(body.weekStart || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return Response.json({ error: "Tuần review không hợp lệ." }, { status: 400 });
      const values = { userId: user.id, weekStart, wins: String(body.wins || "").trim(), blockers: String(body.blockers || "").trim(), lessons: String(body.lessons || "").trim(), nextFocus: String(body.nextFocus || "").trim(), energy: Math.min(5, Math.max(1, Number(body.energy) || 3)), updatedAt: new Date().toISOString() };
      const [review] = await db.insert(weeklyReviews).values(values).onConflictDoUpdate({ target: [weeklyReviews.userId, weeklyReviews.weekStart], set: values }).returning();
      return Response.json({ review });
    }
    if (body.type === "dayNote") {
      const noteDate = String(body.noteDate || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(noteDate)) return Response.json({ error: "Ngày ghi chú không hợp lệ." }, { status: 400 });
      const values = { userId: user.id, noteDate, content: String(body.content || "").trim(), updatedAt: new Date().toISOString() };
      const [dayNote] = await db.insert(dayNotes).values(values).onConflictDoUpdate({ target: [dayNotes.userId, dayNotes.noteDate], set: values }).returning();
      return Response.json({ dayNote });
    }
    if (body.type === "bulkTask") {
      const title = String(body.title || "").trim(); const weekStart = String(body.weekStart || ""); const weeks = Math.min(26, Math.max(1, Number(body.weeks) || 4));
      const weekdays = Array.isArray(body.weekdays) ? body.weekdays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6) : [];
      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !weekdays.length) return Response.json({ error: "Hãy nhập việc, tuần bắt đầu và ít nhất một ngày trong tuần." }, { status: 400 });
      const start = new Date(`${weekStart}T12:00:00Z`); const dates = Array.from({ length: weeks }, (_, week) => weekdays.map((day) => { const date = new Date(start); date.setUTCDate(date.getUTCDate() + week * 7 + day); return date.toISOString().slice(0, 10); })).flat();
      const planId = await ownedPlanId(user.id, body.planId);
      const uniqueDates = [...new Set(dates)];
      const starts = new Map(await Promise.all(uniqueDates.map(async (dueDate) => [dueDate, await nextTaskSortOrder(user.id, dueDate)] as const)));
      const offsets = new Map<string, number>();
      const created = await db.insert(tasks).values(dates.map((dueDate) => {
        const offset = offsets.get(dueDate) || 0; offsets.set(dueDate, offset + 1);
        return { userId: user.id, title, note: String(body.note || "").trim(), dueDate, planId, priority: String(body.priority || "normal"), sortOrder: (starts.get(dueDate) || 0) + offset };
      })).returning();
      return Response.json({ tasks: created }, { status: 201 });
    }
    const title = String(body.title || "").trim();
    if (!title) return Response.json({ error: "Nội dung công việc là bắt buộc." }, { status: 400 });
    const dueDate = String(body.dueDate || "") || null;
    const [task] = await db.insert(tasks).values({ userId: user.id, title, note: String(body.note || "").trim(), dueDate, planId: await ownedPlanId(user.id, body.planId), priority: String(body.priority || "normal"), sortOrder: await nextTaskSortOrder(user.id, dueDate) }).returning();
    return Response.json({ task }, { status: 201 });
  } catch (error) { return Response.json({ error: message(error) }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return signedOut();
    const body = (await request.json()) as Record<string, unknown> & { id?: number; completed?: boolean; type?: string; mode?: string };
    const db = getDb();
    if (body.mode === "reorder") {
      const dueDate = String(body.dueDate || "");
      const taskIds = Array.isArray(body.taskIds) ? [...new Set(body.taskIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))] : [];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !taskIds.length) return Response.json({ error: "Thứ tự lịch không hợp lệ." }, { status: 400 });
      const owned = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.userId, user.id), eq(tasks.dueDate, dueDate), inArray(tasks.id, taskIds)));
      if (owned.length !== taskIds.length) return Response.json({ error: "Không thể sắp xếp lịch này." }, { status: 404 });
      await Promise.all(taskIds.map((id, sortOrder) => db.update(tasks).set({ sortOrder }).where(and(eq(tasks.id, id), eq(tasks.userId, user.id), eq(tasks.dueDate, dueDate)))));
      const ordered = await db.select().from(tasks).where(and(eq(tasks.userId, user.id), eq(tasks.dueDate, dueDate))).orderBy(asc(tasks.sortOrder), asc(tasks.id));
      return Response.json({ tasks: ordered });
    }
    if (!body.id) return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
    if (body.mode === "update") {
      if (body.type === "task") {
        const title = String(body.title || "").trim(); if (!title) return Response.json({ error: "Nội dung công việc là bắt buộc." }, { status: 400 });
        const [task] = await db.update(tasks).set({ title, note: String(body.note || "").trim(), dueDate: String(body.dueDate || "") || null, planId: await ownedPlanId(user.id, body.planId), priority: String(body.priority || "normal") }).where(and(eq(tasks.id, body.id), eq(tasks.userId, user.id))).returning();
        return task ? Response.json({ task }) : Response.json({ error: "Không tìm thấy công việc." }, { status: 404 });
      }
      if (body.type === "habit") {
        const name = String(body.name || "").trim(); if (!name) return Response.json({ error: "Tên thói quen là bắt buộc." }, { status: 400 });
        const [habit] = await db.update(habits).set({ name, planId: await ownedPlanId(user.id, body.planId), targetPerWeek: Math.min(7, Math.max(1, Number(body.targetPerWeek) || 5)), color: String(body.color || "sage") }).where(and(eq(habits.id, body.id), eq(habits.userId, user.id))).returning();
        return habit ? Response.json({ habit }) : Response.json({ error: "Không tìm thấy thói quen." }, { status: 404 });
      }
      if (body.type === "goal") {
        const title = String(body.title || "").trim(); const targetDate = String(body.targetDate || ""); if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return Response.json({ error: "Mục tiêu cần tên và ngày đích hợp lệ." }, { status: 400 });
        const [goal] = await db.update(goals).set({ title, targetDate, planId: await ownedPlanId(user.id, body.planId) }).where(and(eq(goals.id, body.id), eq(goals.userId, user.id))).returning();
        return goal ? Response.json({ goal }) : Response.json({ error: "Không tìm thấy mục tiêu." }, { status: 404 });
      }
      if (body.type === "plan") {
        const name = String(body.name || "").trim(); if (!name) return Response.json({ error: "Tên mảng là bắt buộc." }, { status: 400 });
        const [plan] = await db.update(plans).set({ name, color: String(body.color || "sage") }).where(and(eq(plans.id, body.id), eq(plans.userId, user.id))).returning();
        return plan ? Response.json({ plan }) : Response.json({ error: "Không tìm thấy mảng này." }, { status: 404 });
      }
    }
    if (typeof body.completed !== "boolean") return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
    const [task] = await db.update(tasks).set({ completed: body.completed }).where(and(eq(tasks.id, body.id), eq(tasks.userId, user.id))).returning();
    return task ? Response.json({ task }) : Response.json({ error: "Không tìm thấy công việc." }, { status: 404 });
  } catch (error) { return Response.json({ error: message(error) }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return signedOut();
    const url = new URL(request.url); const id = Number(url.searchParams.get("id")); const kind = url.searchParams.get("kind") || "task";
    if (!id) return Response.json({ error: "Thiếu mã dữ liệu." }, { status: 400 });
    const db = getDb();
    if (kind === "dayNote") await db.delete(dayNotes).where(and(eq(dayNotes.id, id), eq(dayNotes.userId, user.id)));
    else if (kind === "habit") await db.delete(habits).where(and(eq(habits.id, id), eq(habits.userId, user.id)));
    else if (kind === "goal") await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, user.id)));
    else if (kind === "plan") await db.delete(plans).where(and(eq(plans.id, id), eq(plans.userId, user.id)));
    else if (kind === "review") await db.delete(weeklyReviews).where(and(eq(weeklyReviews.id, id), eq(weeklyReviews.userId, user.id)));
    else await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, user.id)));
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ error: message(error) }, { status: 500 }); }
}
