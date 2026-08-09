"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Plan = { id: number; name: string; color: string; createdAt: string };
type Task = {
  id: number;
  planId: number | null;
  title: string;
  note: string;
  dueDate: string | null;
  priority: "low" | "normal" | "high";
  completed: boolean;
  createdAt: string;
};
type View = "today" | "week" | "all" | "completed" | `plan:${number}`;

const colors = ["sage", "blue", "coral", "gold", "lavender"];
const colorHex: Record<string, string> = {
  sage: "#59816e", blue: "#6680a8", coral: "#bd765f", gold: "#b3914d", lavender: "#8a78a5",
};

function isoDate(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

export default function Home() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<View>("today");
  const [taskModal, setTaskModal] = useState(false);
  const [planModal, setPlanModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/data", { cache: "no-store" });
      const data = await response.json() as { plans?: Plan[]; tasks?: Task[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Không thể tải dữ liệu.");
      setPlans(data.plans || []);
      setTasks(data.tasks || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const today = isoDate();
  const weekEnd = isoDate(new Date(Date.now() + 6 * 86400000));
  const visible = useMemo(() => tasks.filter((task) => {
    if (view === "today") return !task.completed && task.dueDate === today;
    if (view === "week") return !task.completed && !!task.dueDate && task.dueDate >= today && task.dueDate <= weekEnd;
    if (view === "all") return !task.completed;
    if (view === "completed") return task.completed;
    return task.planId === Number(view.split(":")[1]);
  }), [tasks, view, today, weekEnd]);

  const dueToday = tasks.filter((task) => !task.completed && task.dueDate === today).length;
  const done = tasks.filter((task) => task.completed).length;
  const completion = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const selectedPlan = view.startsWith("plan:") ? plans.find((plan) => plan.id === Number(view.split(":")[1])) : undefined;
  const titles: Record<string, [string, string]> = {
    today: ["Hôm nay", "Chỉ những việc quan trọng, trong một ngày vừa đủ."],
    week: ["7 ngày tới", "Nhìn trước để tuần này luôn trong tầm tay."],
    all: ["Tất cả việc", "Mọi điều bạn đang muốn hoàn thành."],
    completed: ["Đã hoàn thành", "Những bước tiến bạn đã tạo ra."],
  };
  const [heading, subheading] = selectedPlan
    ? [selectedPlan.name, `Kế hoạch ${selectedPlan.name.toLowerCase()} của riêng bạn.`]
    : titles[view];

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/data", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "task", title: form.get("title"), note: form.get("note"),
          dueDate: form.get("dueDate"), planId: Number(form.get("planId")) || null,
          priority: form.get("priority"),
        }),
      });
      const data = await response.json() as { task?: Task; error?: string };
      if (!response.ok || !data.task) throw new Error(data.error || "Không thể thêm công việc.");
      setTasks((items) => [data.task!, ...items]);
      setTaskModal(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể thêm công việc."); }
    finally { setSaving(false); }
  }

  async function addPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/data", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "plan", name: form.get("name"), color: form.get("color") }),
      });
      const data = await response.json() as { plan?: Plan; error?: string };
      if (!response.ok || !data.plan) throw new Error(data.error || "Không thể tạo kế hoạch.");
      setPlans((items) => [...items, data.plan!]);
      setView(`plan:${data.plan.id}`);
      setPlanModal(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tạo kế hoạch."); }
    finally { setSaving(false); }
  }

  async function toggleTask(task: Task) {
    const completed = !task.completed;
    setTasks((items) => items.map((item) => item.id === task.id ? { ...item, completed } : item));
    const response = await fetch("/api/data", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: task.id, completed }),
    });
    if (!response.ok) { setTasks((items) => items.map((item) => item.id === task.id ? task : item)); setError("Chưa thể cập nhật công việc."); }
  }

  async function removeTask(id: number) {
    const previous = tasks;
    setTasks((items) => items.filter((item) => item.id !== id));
    const response = await fetch(`/api/data?id=${id}`, { method: "DELETE" });
    if (!response.ok) { setTasks(previous); setError("Chưa thể xóa công việc."); }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">P</span><b>planary</b></div>
        <button className="new-task" onClick={() => setTaskModal(true)}><span>+</span> Thêm việc</button>
        <nav aria-label="Chế độ xem">
          <p>TỔNG QUAN</p>
          <button className={view === "today" ? "active" : ""} onClick={() => setView("today")}><span>☀</span> Hôm nay <b>{dueToday || ""}</b></button>
          <button className={view === "week" ? "active" : ""} onClick={() => setView("week")}><span>▦</span> 7 ngày tới</button>
          <button className={view === "all" ? "active" : ""} onClick={() => setView("all")}><span>≡</span> Tất cả</button>
          <button className={view === "completed" ? "active" : ""} onClick={() => setView("completed")}><span>✓</span> Đã xong</button>
        </nav>
        <nav className="plan-nav" aria-label="Kế hoạch">
          <div className="nav-title"><p>KẾ HOẠCH</p><button onClick={() => setPlanModal(true)} aria-label="Tạo kế hoạch">+</button></div>
          {plans.map((plan) => <button key={plan.id} className={view === `plan:${plan.id}` ? "active" : ""} onClick={() => setView(`plan:${plan.id}`)}><i style={{ background: colorHex[plan.color] || colorHex.sage }} />{plan.name}<b>{tasks.filter((task) => task.planId === plan.id && !task.completed).length || ""}</b></button>)}
        </nav>
        <div className="sidebar-foot"><span>MN</span><div><b>Không gian của tôi</b><small>Riêng tư & đã lưu</small></div></div>
      </aside>

      <section className="content">
        <header className="mobile-header"><div className="brand"><span className="brand-mark">P</span><b>planary</b></div><button onClick={() => setTaskModal(true)}>+ Thêm việc</button></header>
        <div className="content-inner">
          <section className="welcome">
            <div><p className="date-line">{new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toUpperCase()}</p><h1>{view === "today" ? `${greeting()}, Minh.` : heading}</h1><p>{view === "today" ? subheading : subheading}</p></div>
            <div className="focus-ring" style={{ "--progress": `${completion * 3.6}deg` } as React.CSSProperties}><div><strong>{completion}%</strong><span>đã xong</span></div></div>
          </section>

          <section className="quick-stats" aria-label="Tổng quan cá nhân">
            <article><span>HÔM NAY</span><strong>{dueToday}</strong><small>việc cần làm</small></article>
            <article><span>ĐÃ HOÀN THÀNH</span><strong>{done}</strong><small>việc tổng cộng</small></article>
            <article><span>KẾ HOẠCH ĐANG CÓ</span><strong>{plans.length}</strong><small>mảng cuộc sống</small></article>
            <blockquote>“Một ngày nhẹ nhàng bắt đầu từ một kế hoạch rõ ràng.”</blockquote>
          </section>

          {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}

          <section className="task-section">
            <div className="section-title"><div><p className="eyebrow">VIỆC CẦN CHÚ Ý</p><h2>{heading}</h2></div><button className="outline" onClick={() => setTaskModal(true)}>+ Thêm việc</button></div>
            <div className="task-list">
              {loading && <div className="state"><span className="loader" />Đang chuẩn bị không gian của bạn...</div>}
              {!loading && visible.map((task) => {
                const plan = plans.find((item) => item.id === task.planId);
                return <article className={`task ${task.completed ? "is-done" : ""}`} key={task.id}>
                  <button className="task-check" onClick={() => toggleTask(task)} aria-label={task.completed ? `Mở lại ${task.title}` : `Hoàn thành ${task.title}`}>{task.completed ? "✓" : ""}</button>
                  <div className="task-copy"><strong>{task.title}</strong>{task.note && <p>{task.note}</p>}<div className="task-meta">{plan && <span><i style={{ background: colorHex[plan.color] || colorHex.sage }} />{plan.name}</span>}{task.dueDate && <time className={task.dueDate < today && !task.completed ? "overdue" : ""}>{task.dueDate === today ? "Hôm nay" : new Intl.DateTimeFormat("vi-VN", { day: "numeric", month: "short" }).format(new Date(`${task.dueDate}T12:00:00`))}</time>}{task.priority === "high" && <span className="priority">Quan trọng</span>}</div></div>
                  <button className="remove" onClick={() => removeTask(task.id)} aria-label={`Xóa ${task.title}`}>×</button>
                </article>;
              })}
              {!loading && !visible.length && <div className="empty-state"><span>✓</span><h3>Mọi thứ đều ổn.</h3><p>{view === "today" ? "Hôm nay chưa có việc nào. Hãy thêm một việc nhỏ bạn muốn hoàn thành." : "Không có công việc trong chế độ xem này."}</p><button onClick={() => setTaskModal(true)}>Thêm việc đầu tiên</button></div>}
            </div>
          </section>

          <section className="plan-grid"><div className="section-title"><div><p className="eyebrow">BỨC TRANH LỚN</p><h2>Các mảng của tôi</h2></div><button className="text-button" onClick={() => setPlanModal(true)}>+ Kế hoạch mới</button></div><div className="cards">{plans.map((plan) => {
            const own = tasks.filter((task) => task.planId === plan.id); const ownDone = own.filter((task) => task.completed).length; const percent = own.length ? Math.round(ownDone / own.length * 100) : 0;
            return <button className="plan-card" key={plan.id} onClick={() => setView(`plan:${plan.id}`)}><span className="plan-icon" style={{ color: colorHex[plan.color], background: `${colorHex[plan.color]}18` }}>{plan.name.slice(0, 1).toUpperCase()}</span><div><strong>{plan.name}</strong><small>{own.length - ownDone} việc đang mở</small></div><div className="mini-progress"><i style={{ width: `${percent}%`, background: colorHex[plan.color] }} /></div><em>{percent}%</em></button>;
          })}</div></section>
        </div>
      </section>

      {taskModal && <div className="modal-backdrop" onMouseDown={() => setTaskModal(false)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="task-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">THÊM VÀO KẾ HOẠCH</p><h2 id="task-title">Việc mới</h2></div><button onClick={() => setTaskModal(false)} aria-label="Đóng">×</button></div><form onSubmit={addTask}><label>Việc bạn muốn làm<input name="title" autoFocus required placeholder="Ví dụ: Đọc 20 trang sách" /></label><label>Ghi chú <span>(không bắt buộc)</span><textarea name="note" placeholder="Thêm một chút bối cảnh..." /></label><div className="form-row"><label>Thuộc kế hoạch<select name="planId" defaultValue={selectedPlan?.id || plans[0]?.id || ""}>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label><label>Hạn hoàn thành<input name="dueDate" type="date" defaultValue={today} /></label></div><label>Mức ưu tiên<select name="priority" defaultValue="normal"><option value="low">Nhẹ nhàng</option><option value="normal">Bình thường</option><option value="high">Quan trọng</option></select></label><div className="form-actions"><button type="button" onClick={() => setTaskModal(false)}>Hủy</button><button className="submit" disabled={saving}>{saving ? "Đang lưu..." : "Thêm vào kế hoạch"}</button></div></form></div></div>}

      {planModal && <div className="modal-backdrop" onMouseDown={() => setPlanModal(false)}><div className="modal small" role="dialog" aria-modal="true" aria-labelledby="plan-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">MỘT MẢNG CUỘC SỐNG</p><h2 id="plan-title">Kế hoạch mới</h2></div><button onClick={() => setPlanModal(false)} aria-label="Đóng">×</button></div><form onSubmit={addPlan}><label>Tên kế hoạch<input name="name" autoFocus required placeholder="Ví dụ: Học tập" /></label><fieldset><legend>Màu nhận diện</legend><div className="color-options">{colors.map((color, index) => <label key={color}><input type="radio" name="color" value={color} defaultChecked={index === 0} /><span style={{ background: colorHex[color] }} /></label>)}</div></fieldset><div className="form-actions"><button type="button" onClick={() => setPlanModal(false)}>Hủy</button><button className="submit" disabled={saving}>{saving ? "Đang tạo..." : "Tạo kế hoạch"}</button></div></form></div></div>}
    </main>
  );
}
