import { asc, desc, eq } from "drizzle-orm";
import { ensureDb, getDb } from "../../../db";
import { plans, tasks } from "../../../db/schema";

const starterPlans = [
  { name: "Cá nhân", color: "sage" },
  { name: "Công việc", color: "blue" },
  { name: "Sức khỏe", color: "coral" },
  { name: "Tài chính", color: "gold" },
];

function message(error: unknown) {
  const value = error instanceof Error ? error.message : "Đã có lỗi xảy ra";
  if (value.includes("no such table")) return "Kho dữ liệu chưa sẵn sàng.";
  return value;
}

async function snapshot() {
  await ensureDb();
  const db = getDb();
  let planRows = await db.select().from(plans).orderBy(asc(plans.id));
  if (!planRows.length) {
    planRows = await db.insert(plans).values(starterPlans).returning();
  }
  const taskRows = await db
    .select()
    .from(tasks)
    .orderBy(asc(tasks.completed), asc(tasks.dueDate), desc(tasks.id));
  return { plans: planRows, tasks: taskRows };
}

export async function GET() {
  try {
    return Response.json(await snapshot());
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      type?: "task" | "plan";
      title?: string;
      name?: string;
      note?: string;
      dueDate?: string;
      planId?: number | null;
      priority?: "low" | "normal" | "high";
      color?: string;
    };
    await ensureDb();
    const db = getDb();

    if (body.type === "plan") {
      const name = body.name?.trim();
      if (!name) return Response.json({ error: "Tên kế hoạch là bắt buộc." }, { status: 400 });
      const [plan] = await db.insert(plans).values({ name, color: body.color || "lavender" }).returning();
      return Response.json({ plan }, { status: 201 });
    }

    const title = body.title?.trim();
    if (!title) return Response.json({ error: "Nội dung công việc là bắt buộc." }, { status: 400 });
    const [task] = await db.insert(tasks).values({
      title,
      note: body.note?.trim() || "",
      dueDate: body.dueDate || null,
      planId: body.planId || null,
      priority: body.priority || "normal",
    }).returning();
    return Response.json({ task }, { status: 201 });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: number; completed?: boolean };
    if (!body.id || typeof body.completed !== "boolean") {
      return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
    }
    await ensureDb();
    const db = getDb();
    const [task] = await db.update(tasks).set({ completed: body.completed }).where(eq(tasks.id, body.id)).returning();
    return Response.json({ task });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return Response.json({ error: "Thiếu mã công việc." }, { status: 400 });
    await ensureDb();
    const db = getDb();
    await db.delete(tasks).where(eq(tasks.id, id));
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}
