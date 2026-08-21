"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Plan = { id: number; name: string; color: string; createdAt: string };
type Task = { id: number; planId: number | null; title: string; note: string; dueDate: string | null; priority: string; completed: boolean; createdAt: string };
type Goal = { id: number; planId: number | null; title: string; targetDate: string | null; progress: number; status: string; createdAt: string };
type Habit = { id: number; planId: number | null; name: string; targetPerWeek: number; color: string; active: boolean; createdAt: string };
type HabitLog = { id: number; habitId: number; logDate: string; createdAt: string };
type WeeklyReview = { id: number; weekStart: string; wins: string; blockers: string; lessons: string; nextFocus: string; energy: number; createdAt: string; updatedAt: string };
type DayNote = { id: number; noteDate: string; content: string; updatedAt: string };
type AccountUser = { id: number; email: string | null; displayName: string; provider: string };
type Section = "overview" | "habits" | "goals" | "week" | "review";
type Modal = "task" | "habit" | "goal" | "plan" | "bulkTask" | null;
type Editing = { kind: "task"; item: Task } | { kind: "habit"; item: Habit } | { kind: "goal"; item: Goal } | { kind: "plan"; item: Plan } | null;

const palette: Record<string, string> = { sage: "#4f7965", blue: "#6683ad", coral: "#c87863", gold: "#b9944e", lavender: "#8a77a7" };
const colorNames = ["sage", "blue", "coral", "gold", "lavender"];

function iso(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
function monthKey(date = new Date()) { return iso(date).slice(0, 7); }
function mondayOf(date = new Date()) { const next = new Date(date); next.setDate(next.getDate() - ((next.getDay() + 6) % 7)); return iso(next); }
function addDays(value: string, amount: number) { const next = new Date(`${value}T12:00:00`); next.setDate(next.getDate() + amount); return iso(next); }
function daysBetween(from: string, to: string) { return Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000); }
function niceDate(value: string | null, fallback = "Chưa đặt hạn") {
  if (!value) return fallback;
  return new Intl.DateTimeFormat("vi-VN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

export default function Home() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [reviews, setReviews] = useState<WeeklyReview[]>([]);
  const [dayNotes, setDayNotes] = useState<DayNote[]>([]);
  const [section, setSection] = useState<Section>("overview");
  const [planFilter, setPlanFilter] = useState<number | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [accountModal, setAccountModal] = useState(false);
  const [month, setMonth] = useState(monthKey());
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => mondayOf());
  const [openDayNote, setOpenDayNote] = useState<string | null>(null);
  const [taskDate, setTaskDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [today, setToday] = useState(() => iso());
  const [year, monthNumber] = month.split("-").map(Number);
  const numberOfDays = new Date(year, monthNumber, 0).getDate();
  const days = Array.from({ length: numberOfDays }, (_, index) => index + 1);
  const isCurrentMonth = month === today.slice(0, 7);
  const elapsedDays = isCurrentMonth ? Math.min(Number(today.slice(8, 10)), numberOfDays) : month < today.slice(0, 7) ? numberOfDays : 0;
  const dateAt = (day: number) => `${month}-${String(day).padStart(2, "0")}`;

  useEffect(() => {
    const timer = window.setInterval(() => setToday(iso()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/data", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { user?: AccountUser | null; plans?: Plan[]; tasks?: Task[]; goals?: Goal[]; habits?: Habit[]; habitLogs?: HabitLog[]; weeklyReviews?: WeeklyReview[]; dayNotes?: DayNote[]; error?: string };
        if (response.status === 401) return { ...data, authRequired: true };
        if (!response.ok) throw new Error(data.error || "Không thể tải dữ liệu.");
        return data;
      })
      .then((data) => {
        if (!active) return;
        if (data.authRequired) { setAuthRequired(true); return; }
        setUser(data.user || null);
        setPlans(data.plans || []); setTasks(data.tasks || []); setGoals(data.goals || []); setHabits(data.habits || []); setLogs(data.habitLogs || []); setReviews(data.weeklyReviews || []); setDayNotes(data.dayNotes || []);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const scopedTasks = tasks.filter((item) => !planFilter || item.planId === planFilter);
  const scopedGoals = goals.filter((item) => !planFilter || item.planId === planFilter);
  const scopedHabits = habits.filter((item) => !planFilter || item.planId === planFilter);
  const monthLogs = logs.filter((log) => log.logDate.startsWith(month) && scopedHabits.some((habit) => habit.id === log.habitId));
  const logKeys = useMemo(() => new Set(logs.map((log) => `${log.habitId}:${log.logDate}`)), [logs]);
  const expectedFor = (habit: Habit) => Math.max(1, Math.ceil(elapsedDays * habit.targetPerWeek / 7));
  const checksFor = (habit: Habit) => monthLogs.filter((log) => log.habitId === habit.id).length;
  const rateFor = (habit: Habit) => elapsedDays ? Math.min(100, Math.round(checksFor(habit) / expectedFor(habit) * 100)) : 0;
  const totalExpected = scopedHabits.reduce((sum, habit) => sum + expectedFor(habit), 0);
  const habitRate = totalExpected ? Math.min(100, Math.round(monthLogs.length / totalExpected * 100)) : 0;
  const dailyCounts = days.map((day) => monthLogs.filter((log) => log.logDate === dateAt(day)).length);
  const maxDaily = Math.max(1, ...dailyCounts);
  const weekly = [1, 8, 15, 22, 29].map((start, index) => {
    const end = Math.min(start + 6, numberOfDays); const active = monthLogs.filter((log) => Number(log.logDate.slice(8, 10)) >= start && Number(log.logDate.slice(8, 10)) <= end).length;
    const availableDays = Math.max(0, Math.min(elapsedDays, end) - start + 1); const target = scopedHabits.reduce((sum, habit) => sum + Math.ceil(availableDays * habit.targetPerWeek / 7), 0);
    return { label: `Tuần ${index + 1}`, active, rate: target ? Math.min(100, Math.round(active / target * 100)) : 0 };
  }).filter((_, index) => index * 7 + 1 <= numberOfDays);
  const topHabits = [...scopedHabits].sort((a, b) => rateFor(b) - rateFor(a)).slice(0, 5);
  const todayTasks = scopedTasks.filter((task) => !task.completed && task.dueDate === today);
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(calendarWeekStart, index));
  const weekTasks = scopedTasks.filter((task) => !!task.dueDate && weekDates.includes(task.dueDate));
  const isCurrentCalendarWeek = calendarWeekStart === mondayOf(today);
  const goalTimeline = (goal: Goal) => {
    const start = goal.createdAt ? iso(new Date(goal.createdAt)) : today;
    if (!goal.targetDate) return { start, elapsed: 0, total: 0, remaining: 0, progress: 0, hasTarget: false };
    const total = Math.max(1, daysBetween(start, goal.targetDate));
    const elapsed = Math.min(total, Math.max(0, daysBetween(start, today)));
    return { start, elapsed, total, remaining: Math.max(0, total - elapsed), progress: Math.round(elapsed / total * 100), hasTarget: true };
  };
  const openGoals = scopedGoals.filter((goal) => !goalTimeline(goal).hasTarget || goalTimeline(goal).progress < 100);
  const completedGoals = goals.filter((goal) => goalTimeline(goal).hasTarget && goalTimeline(goal).progress === 100);
  const selectedPlan = plans.find((plan) => plan.id === planFilter);
  const currentWeekStart = mondayOf();
  const currentReview = reviews.find((review) => review.weekStart === currentWeekStart);

  async function send(body: Record<string, unknown>) {
    const response = await fetch("/api/data", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json() as Record<string, unknown> & { error?: string };
    if (!response.ok) throw new Error(data.error || "Không thể lưu thay đổi.");
    return data;
  }
  function closeModal() { setModal(null); setEditing(null); setTaskDate(null); }
  function beginEdit(next: Exclude<Editing, null>) { setEditing(next); setModal(next.kind); }
  async function update(type: Editing extends never ? never : "task" | "habit" | "goal" | "plan", id: number, body: Record<string, unknown>) {
    const response = await fetch("/api/data", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, mode: "update", id, ...body }) });
    const data = await response.json() as Record<string, unknown> & { error?: string };
    if (!response.ok) throw new Error(data.error || "Chưa thể cập nhật.");
    return data;
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget);
    try { const values = { title: form.get("title"), note: form.get("note"), planId: Number(form.get("planId")) || null, dueDate: form.get("dueDate"), priority: form.get("priority") }; if (editing?.kind === "task") { const data = await update("task", editing.item.id, values); const task = data.task as Task; setTasks((items) => items.map((item) => item.id === task.id ? task : item)); } else { const data = await send({ type: "task", ...values }); setTasks((items) => [data.task as Task, ...items]); } closeModal(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể thêm việc."); } finally { setSaving(false); }
  }
  async function submitHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget);
    try { const values = { name: form.get("name"), planId: Number(form.get("planId")) || null, targetPerWeek: Number(form.get("targetPerWeek")), color: form.get("color") }; if (editing?.kind === "habit") { const data = await update("habit", editing.item.id, values); const habit = data.habit as Habit; setHabits((items) => items.map((item) => item.id === habit.id ? habit : item)); } else { const data = await send({ type: "habit", ...values }); setHabits((items) => [...items, data.habit as Habit]); } closeModal(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể thêm thói quen."); } finally { setSaving(false); }
  }
  async function submitBulkTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget);
    try { const data = await send({ type: "bulkTask", title: form.get("title"), note: form.get("note"), planId: Number(form.get("planId")) || null, priority: form.get("priority"), weekStart: calendarWeekStart, weeks: Number(form.get("weeks")), weekdays: form.getAll("weekdays").map(Number) }); setTasks((items) => [...(data.tasks as Task[]), ...items]); closeModal(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Chưa thể tạo lịch lặp."); } finally { setSaving(false); }
  }
  async function submitGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget);
    try { const values = { title: form.get("title"), planId: Number(form.get("planId")) || null, targetDate: form.get("targetDate") }; if (editing?.kind === "goal") { const data = await update("goal", editing.item.id, values); const goal = data.goal as Goal; setGoals((items) => items.map((item) => item.id === goal.id ? goal : item)); } else { const data = await send({ type: "goal", ...values }); setGoals((items) => [data.goal as Goal, ...items]); } closeModal(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể thêm mục tiêu."); } finally { setSaving(false); }
  }
  async function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget);
    try { const values = { name: form.get("name"), color: form.get("color") }; if (editing?.kind === "plan") { const data = await update("plan", editing.item.id, values); const plan = data.plan as Plan; setPlans((items) => items.map((item) => item.id === plan.id ? plan : item)); } else { const data = await send({ type: "plan", ...values }); const plan = data.plan as Plan; setPlans((items) => [...items, plan]); setPlanFilter(plan.id); } closeModal(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tạo kế hoạch."); } finally { setSaving(false); }
  }
  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget);
    try {
      const data = await send({ type: "review", weekStart: currentWeekStart, wins: form.get("wins"), blockers: form.get("blockers"), lessons: form.get("lessons"), nextFocus: form.get("nextFocus"), energy: Number(form.get("energy")) });
      const review = data.review as WeeklyReview;
      setReviews((items) => [review, ...items.filter((item) => item.weekStart !== review.weekStart)]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể lưu review."); }
    finally { setSaving(false); }
  }

  async function toggleHabit(habitId: number, logDate: string) {
    const key = `${habitId}:${logDate}`; const checked = logKeys.has(key); const previous = logs;
    setLogs((items) => checked ? items.filter((log) => !(log.habitId === habitId && log.logDate === logDate)) : [...items, { id: -Date.now(), habitId, logDate, createdAt: "" }]);
    try { await send({ type: "habitLog", habitId, logDate }); }
    catch { setLogs(previous); setError("Chưa thể lưu check-in."); }
  }
  async function toggleTask(task: Task) {
    const completed = !task.completed; const previous = tasks; setTasks((items) => items.map((item) => item.id === task.id ? { ...item, completed } : item));
    const response = await fetch("/api/data", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: task.id, completed }) });
    if (!response.ok) { setTasks(previous); setError("Chưa thể cập nhật công việc."); }
  }
  async function saveDayNote(noteDate: string, content: string) {
    const previous = dayNotes; const local = { id: previous.find((item) => item.noteDate === noteDate)?.id || -Date.now(), noteDate, content, updatedAt: new Date().toISOString() };
    setDayNotes((items) => [local, ...items.filter((item) => item.noteDate !== noteDate)]);
    try { const data = await send({ type: "dayNote", noteDate, content }); const note = data.dayNote as DayNote; setDayNotes((items) => [note, ...items.filter((item) => item.noteDate !== noteDate)]); }
    catch { setDayNotes(previous); setError("Chưa thể lưu ghi chú ngày này."); }
  }
  async function removeDayNote(note: DayNote) {
    const previous = dayNotes; setDayNotes((items) => items.filter((item) => item.id !== note.id));
    const response = await fetch(`/api/data?kind=dayNote&id=${note.id}`, { method: "DELETE" });
    if (!response.ok) { setDayNotes(previous); setError("Chưa thể xóa ghi chú ngày này."); }
  }
  async function remove(kind: "task" | "habit" | "goal" | "plan" | "review", id: number) {
    const response = await fetch(`/api/data?kind=${kind}&id=${id}`, { method: "DELETE" });
    if (!response.ok) return setError("Chưa thể xóa mục này.");
    if (kind === "task") setTasks((items) => items.filter((item) => item.id !== id));
    if (kind === "habit") setHabits((items) => items.filter((item) => item.id !== id));
    if (kind === "goal") setGoals((items) => items.filter((item) => item.id !== id));
    if (kind === "plan") { setPlans((items) => items.filter((item) => item.id !== id)); if (planFilter === id) setPlanFilter(null); }
    if (kind === "review") setReviews((items) => items.filter((item) => item.id !== id));
  }
  function shiftMonth(offset: number) { const next = new Date(year, monthNumber - 1 + offset, 1); setMonth(monthKey(next)); }
  async function signOut() {
    await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    window.location.assign("/");
  }

  const nav = [
    { id: "overview", icon: "⌂", label: "Tổng quan" }, { id: "habits", icon: "▦", label: "Thói quen" },
    { id: "goals", icon: "◎", label: "Mục tiêu" }, { id: "week", icon: "≡", label: "Kế hoạch tuần" }, { id: "review", icon: "↻", label: "Review tuần" },
  ] as const;

  if (loading) return <main className="auth-shell"><div className="auth-card auth-loading"><span className="auth-mark">P</span><div className="loading"><span />Đang bảo vệ không gian của bạn...</div></div></main>;
  if (authRequired) return <AuthScreen onBack={user?.provider === "guest" ? () => setAuthRequired(false) : undefined} />;

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span>P</span><div><b>planary</b><small>personal system</small></div></div>
      <button className="quick-add" onClick={() => setModal("task")}><span>+</span> Ghi nhanh một việc</button>
      <nav aria-label="Không gian chính"><p>HỆ THỐNG CỦA TÔI</p>{nav.map((item) => <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => setSection(item.id)}><span>{item.icon}</span>{item.label}{item.id === "habits" && <b>{habitRate}%</b>}</button>)}</nav>
      <nav className="areas" aria-label="Mảng cuộc sống"><div className="nav-heading"><p>MẢNG CUỘC SỐNG</p><button onClick={() => setModal("plan")}>+</button></div><button className={!planFilter ? "active" : ""} onClick={() => setPlanFilter(null)}><i className="all-dot" />Tất cả</button>{plans.map((plan) => <div className="plan-nav-row" key={plan.id}><button className={planFilter === plan.id ? "active" : ""} onClick={() => setPlanFilter(plan.id)}><i style={{ background: palette[plan.color] || palette.sage }} />{plan.name}</button><button className="plan-edit" aria-label={`Sửa mảng ${plan.name}`} onClick={() => beginEdit({ kind: "plan", item: plan })}>⌕</button><button className="plan-delete" aria-label={`Xóa mảng ${plan.name}`} onClick={() => remove("plan", plan.id)}>×</button></div>)}</nav>
      <div className="system-note"><span>NHỊP PLANARY</span><p>Mục tiêu → Tuần → Hôm nay → Review</p></div>
      <div className="profile"><span>{user?.provider === "guest" ? "K" : (user?.displayName || "B").slice(0, 2).toUpperCase()}</span><div><b>{user?.provider === "guest" ? "Dùng nhanh" : user?.displayName || "Không gian cá nhân"}</b><small>{user?.provider === "guest" ? "Gắn với trình duyệt này" : user?.email || "Dữ liệu riêng tư"}</small></div>{user?.provider === "guest" ? <div className="profile-actions"><button onClick={() => setAuthRequired(true)}>Đăng nhập</button><button onClick={() => setAccountModal(true)}>Lưu</button></div> : <button className="sign-out" onClick={signOut}>Thoát</button>}</div>
    </aside>

    <section className="main">
      <header className="topbar"><div className="mobile-brand"><span>P</span><b>planary</b></div><div className="context"><span style={{ background: selectedPlan ? palette[selectedPlan.color] : "#5d756a" }} />{selectedPlan?.name || "Tất cả mảng"}</div><div className="top-actions"><time>{new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</time><button onClick={() => section === "review" ? document.getElementById("review-form")?.scrollIntoView({ behavior: "smooth" }) : setModal(section === "habits" ? "habit" : section === "goals" ? "goal" : "task")}>{section === "review" ? "Review ngay" : "+ Thêm mới"}</button></div></header>
      <div className={`main-inner motion-stage motion-${section}`}>
        {error && <div className="alert" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}
        <>

          {section === "overview" && <>
            <section className="hero"><div><p className="eyebrow">TỔNG QUAN · {new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(new Date())}</p><h1>Biến kế hoạch<br />thành <em>nhịp sống.</em></h1><p>Một bức tranh liền mạch từ mục tiêu dài hạn đến việc bạn làm mỗi ngày.</p></div><div className="month-score" style={{ "--score": `${habitRate * 3.6}deg` } as React.CSSProperties}><div><strong>{habitRate}%</strong><span>nhịp tháng</span></div></div></section>
            <section className="metric-strip"><article><span>CHECK-IN THÁNG NÀY</span><MetricNumber value={monthLogs.length} /><small>lần giữ nhịp</small></article><article><span>VIỆC HÔM NAY</span><MetricNumber value={todayTasks.length} /><small>{todayTasks.filter((item) => item.priority === "high").length} việc quan trọng</small></article><article><span>MỤC TIÊU ĐANG CHẠY</span><MetricNumber value={openGoals.length} /><small>{completedGoals.length} đã đến đích</small></article><article className="principle"><span>NGUYÊN TẮC THÁNG</span><p>Tiến bộ nhỏ, đều đặn<br />quan trọng hơn hoàn hảo.</p></article></section>
            <section className="analytics-grid">
              <article className="panel trend"><div className="panel-head"><div><p className="eyebrow">BIẾN ĐỘNG HÀNG NGÀY</p><h2>Nhịp thói quen</h2></div><button onClick={() => setSection("habits")}>Mở bảng theo dõi →</button></div><div className="daily-chart">{dailyCounts.map((count, index) => <div className="bar-column" key={index}><i style={{ height: `${Math.max(4, count / maxDaily * 100)}%` }} /><span>{[0, 6, 13, 20, 27, numberOfDays - 1].includes(index) ? index + 1 : ""}</span></div>)}</div><div className="chart-foot"><span><i /> Mỗi cột là số lần check-in trong ngày</span><b>Cao nhất {maxDaily} lần/ngày</b></div></article>
              <article className="panel completion"><p className="eyebrow">CƠ CẤU HOÀN THÀNH</p><div className="big-ring" style={{ "--score": `${habitRate * 3.6}deg` } as React.CSSProperties}><div><strong>{monthLogs.length}</strong><span>/ {totalExpected || 0} mục tiêu</span></div></div><h3>{habitRate >= 80 ? "Nhịp rất tốt" : habitRate >= 50 ? "Đang tạo đà" : "Cứ bắt đầu nhỏ"}</h3><p>{habitRate}% khối lượng thói quen dự kiến đã hoàn thành.</p></article>
              <article className="panel week-panel"><div className="panel-head"><div><p className="eyebrow">TỔNG QUAN THEO TUẦN</p><h2>Độ ổn định</h2></div></div><div className="weekly-bars">{weekly.map((item) => <div key={item.label}><div className="week-bar"><i style={{ height: `${Math.max(5, item.rate)}%` }} /></div><strong>{item.rate}%</strong><span>{item.label.replace("Tuần ", "T")}</span></div>)}</div></article>
              <article className="panel top-panel"><div className="panel-head"><div><p className="eyebrow">TOP THÓI QUEN</p><h2>Đang giữ nhịp tốt</h2></div></div><div className="rank-list">{topHabits.map((habit, index) => <div key={habit.id}><b>{String(index + 1).padStart(2, "0")}</b><span><strong>{habit.name}</strong><small>{checksFor(habit)} lần trong tháng</small></span><em>{rateFor(habit)}%</em></div>)}</div></article>
            </section>
            <section className="two-columns"><article className="panel today-panel"><div className="panel-head"><div><p className="eyebrow">HÀNH ĐỘNG</p><h2>Việc quan trọng hôm nay</h2></div><button onClick={() => setModal("task")}>+ Thêm việc</button></div><TaskList tasks={todayTasks} plans={plans} today={today} onToggle={toggleTask} onRemove={(id) => remove("task", id)} empty="Hôm nay chưa có việc. Hãy chọn 1–3 việc thật sự quan trọng." /></article><article className="panel goals-preview"><div className="panel-head"><div><p className="eyebrow">KẾT QUẢ</p><h2>Mục tiêu trọng tâm</h2></div><button onClick={() => setSection("goals")}>Xem tất cả →</button></div>{openGoals.slice(0, 3).map((goal) => { const timeline = goalTimeline(goal); return <div className="goal-row" key={goal.id}><div><strong>{goal.title}</strong><small>{timeline.hasTarget ? `Ngày ${timeline.elapsed}/${timeline.total} · ${niceDate(goal.targetDate)}` : "Cần đặt ngày đích"}</small></div><span><i style={{ width: `${timeline.progress}%` }} /></span><b>{timeline.progress}%</b></div>; })}{!openGoals.length && <div className="compact-empty"><b>Chưa có mục tiêu trọng tâm.</b><button onClick={() => setModal("goal")}>Tạo mục tiêu đầu tiên</button></div>}</article></section>
          </>}

          {section === "habits" && <>
            <section className="page-heading"><div><p className="eyebrow">HỆ THỐNG ĐẦU VÀO</p><h1>Bảng theo dõi thói quen</h1><p>Check-in mỗi ngày, xem nhịp theo tuần và tìm ra thói quen tạo nhiều tiến bộ nhất.</p></div><button className="primary" onClick={() => setModal("habit")}>+ Thói quen mới</button></section>
            <section className="tracker panel"><div className="tracker-toolbar"><div className="month-switch"><button onClick={() => shiftMonth(-1)}>‹</button><strong>{new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1))}</strong><button onClick={() => shiftMonth(1)}>›</button></div><div className="tracker-summary"><span><b>{monthLogs.length}</b> check-in</span><span><b>{habitRate}%</b> mục tiêu</span></div></div><div className="tracker-scroll"><div className="habit-grid" style={{ "--days": numberOfDays } as React.CSSProperties}><div className="habit-label header-cell">THÓI QUEN HÀNG NGÀY</div>{days.map((day) => <div className={`day-head week-${Math.min(5, Math.ceil(day / 7))}`} key={day}><span>{new Intl.DateTimeFormat("vi-VN", { weekday: "short" }).format(new Date(year, monthNumber - 1, day)).slice(0, 2)}</span><b>{day}</b></div>)}<div className="progress-head">TIẾN ĐỘ</div>{scopedHabits.map((habit) => <div className="habit-row" key={habit.id} style={{ display: "contents" }}><div className="habit-label"><i style={{ background: palette[habit.color] || palette.sage }} /><span><strong>{habit.name}</strong><small>Mục tiêu {habit.targetPerWeek} ngày/tuần</small></span><button onClick={() => beginEdit({ kind: "habit", item: habit })} aria-label={`Sửa ${habit.name}`}>⌕</button><button onClick={() => remove("habit", habit.id)} aria-label={`Xóa ${habit.name}`}>×</button></div>{days.map((day) => { const key = `${habit.id}:${dateAt(day)}`; const future = dateAt(day) > today; return <button className={`habit-cell week-${Math.min(5, Math.ceil(day / 7))} ${logKeys.has(key) ? "checked" : ""}`} style={{ "--habit": palette[habit.color] || palette.sage } as React.CSSProperties} disabled={future} onClick={() => toggleHabit(habit.id, dateAt(day))} key={day} aria-label={`${habit.name}, ngày ${day}`}>{logKeys.has(key) ? "✓" : ""}</button>})}<div className="habit-progress"><span><i style={{ width: `${rateFor(habit)}%`, background: palette[habit.color] || palette.sage }} /></span><b>{checksFor(habit)}/{expectedFor(habit)}</b><em>{rateFor(habit)}%</em></div></div>)}</div></div></section>
            <section className="habit-insights"><article className="panel"><p className="eyebrow">THEO TUẦN</p><h2>Tỷ lệ hoàn thành</h2><div className="week-cards">{weekly.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.rate}%</strong><div><i style={{ width: `${item.rate}%` }} /></div><small>{item.active} check-in</small></div>)}</div></article><article className="panel coaching"><p className="eyebrow">GỢI Ý REVIEW</p><h2>Đừng chỉ nhìn vào chuỗi.</h2><p>Mỗi cuối tuần, hãy hỏi: thói quen nào dễ giữ nhất, điều gì làm mình bỏ lỡ, và cần giảm mục tiêu hay đổi môi trường?</p><div><b>{topHabits[0]?.name || "Chưa có dữ liệu"}</b><span>Thói quen ổn định nhất</span></div></article></section>
          </>}

          {section === "goals" && <>
            <section className="page-heading"><div><p className="eyebrow">HỆ THỐNG KẾT QUẢ</p><h1>Mục tiêu có điểm đến</h1><p>Giữ ít mục tiêu, đo tiến độ thật và nối chúng với những việc bạn làm hằng tuần.</p></div><button className="primary" onClick={() => setModal("goal")}>+ Mục tiêu mới</button></section>
            <section className="goal-method"><div><span>01</span><b>Chọn kết quả</b><p>Mô tả điều bạn muốn đạt được.</p></div><i /><div><span>02</span><b>Thiết kế hệ thống</b><p>Gắn thói quen và hành động lặp lại.</p></div><i /><div><span>03</span><b>Review mỗi tuần</b><p>Đo, học và điều chỉnh nhịp độ.</p></div></section>
            <section className="goal-board">{scopedGoals.map((goal) => { const plan = plans.find((item) => item.id === goal.planId); const timeline = goalTimeline(goal); return <article className={`goal-card ${timeline.progress === 100 ? "done" : ""}`} key={goal.id}><div className="goal-card-head"><span style={{ color: plan ? palette[plan.color] : palette.sage, background: `${plan ? palette[plan.color] : palette.sage}18` }}>{plan?.name || "Chung"}</span><div><button aria-label={`Sửa ${goal.title}`} onClick={() => beginEdit({ kind: "goal", item: goal })}>⌕</button><button aria-label={`Xóa ${goal.title}`} onClick={() => remove("goal", goal.id)}>×</button></div></div><h2>{goal.title}</h2><time>{timeline.hasTarget ? `Bắt đầu · ${niceDate(timeline.start)}  /  Đích · ${niceDate(goal.targetDate)}` : "Chưa đặt ngày đích"}</time><div className="goal-progress"><div><i style={{ width: `${timeline.progress}%` }} /></div><strong>{timeline.progress}%</strong></div>{timeline.hasTarget ? <div className="goal-schedule"><span>Ngày {timeline.elapsed}/{timeline.total}</span><span>{timeline.remaining ? `Còn ${timeline.remaining} ngày` : "Đã đến đích"}</span></div> : <p className="goal-missing-date">Thêm ngày đích để Planary tự tính tiến độ.</p>}</article>; })}{!scopedGoals.length && <div className="large-empty"><span>◎</span><h2>Bắt đầu với một kết quả rõ ràng.</h2><p>Một mục tiêu tốt có điểm đến, thời hạn và cách đo tiến độ.</p><button onClick={() => setModal("goal")}>Tạo mục tiêu</button></div>}</section>
          </>}

          {section === "week" && <>
            <section className="page-heading"><div><p className="eyebrow">THỜI KHÓA BIỂU CÁ NHÂN</p><h1>Kế hoạch 7 ngày</h1><p>Mỗi tuần là một khung T2–CN. Chọn tuần, đặt việc vào từng ngày và để lại ghi chú cho chính mình.</p></div><div className="week-heading-actions"><button className="secondary" onClick={() => setModal("bulkTask")}>↻ Lặp theo tuần</button><button className="primary" onClick={() => { setTaskDate(calendarWeekStart); setModal("task"); }}>+ Lên việc</button></div></section>
            <section className="week-navigator panel"><div className="week-switch"><button aria-label="Tuần trước" onClick={() => setCalendarWeekStart((value) => addDays(value, -7))}>‹</button><div><span>{isCurrentCalendarWeek ? "TUẦN HIỆN TẠI" : "TUẦN ĐANG XEM"}</span><strong>{niceDate(calendarWeekStart, "")} — {niceDate(weekDates[6], "")}</strong></div><button aria-label="Tuần sau" onClick={() => setCalendarWeekStart((value) => addDays(value, 7))}>›</button></div><button className="week-today" disabled={isCurrentCalendarWeek} onClick={() => setCalendarWeekStart(mondayOf(today))}>Hôm nay</button></section>
            <section className="week-overview"><article><span>VIỆC TRONG TUẦN</span><strong>{weekTasks.length}</strong></article><article><span>ĐÃ HOÀN THÀNH</span><strong>{weekTasks.filter((task) => task.completed).length}</strong></article><article><span>CÒN LẠI</span><strong>{weekTasks.filter((task) => !task.completed).length}</strong></article><article><span>TRỌNG TÂM</span><strong>{weekTasks.filter((task) => task.priority === "high").length}</strong></article></section>
            <section className="week-board">{weekDates.map((date) => { const items = scopedTasks.filter((task) => task.dueDate === date); const note = dayNotes.find((item) => item.noteDate === date); const isToday = date === today; return <article className={`day-column ${isToday ? "today" : ""}`} key={date}><header><span>{isToday ? "HÔM NAY" : new Intl.DateTimeFormat("vi-VN", { weekday: "short" }).format(new Date(`${date}T12:00:00`)).toUpperCase()}</span><strong>{Number(date.slice(8, 10))}</strong><small>THÁNG {Number(date.slice(5, 7))}</small><div className="day-menu"><button aria-label={`Thêm việc ngày ${date}`} onClick={() => { setTaskDate(date); setModal("task"); }}>+</button><button className={note?.content ? "has-note" : ""} aria-label={`Ghi chú ngày ${date}`} onClick={() => setOpenDayNote((value) => value === date ? null : date)}>⌑</button></div></header><div>{openDayNote === date && <DayNoteEditor date={date} initialValue={note?.content || ""} note={note} onClose={() => setOpenDayNote(null)} onSave={saveDayNote} onDelete={removeDayNote} />}{items.map((task) => <div className="week-task-wrap" key={task.id}><button className={`week-task ${task.completed ? "done" : ""}`} onClick={() => toggleTask(task)}><i>{task.completed ? "✓" : ""}</i><span>{task.title}<small>{plans.find((plan) => plan.id === task.planId)?.name || "Chung"}</small></span></button><button className="week-task-edit" aria-label={`Sửa ${task.title}`} onClick={() => beginEdit({ kind: "task", item: task })}>⌕</button><button className="week-task-delete" aria-label={`Xóa ${task.title}`} onClick={() => remove("task", task.id)}>×</button></div>)}{!items.length && !note?.content && <p className="free-day">Khoảng thở</p>}</div></article>})}</section>
            <section className="review-card"><span>REVIEW CUỐI TUẦN</span><h2>Ba câu hỏi giữ kế hoạch sống.</h2><div><p><b>01</b> Điều gì đã tiến triển?</p><p><b>02</b> Điều gì đang bị kẹt?</p><p><b>03</b> Tuần tới bỏ bớt điều gì?</p></div></section>
          </>}

          {section === "review" && <>
            <section className="page-heading review-heading"><div><p className="eyebrow">KHÉP LẠI ĐỂ TIẾN LÊN</p><h1>Review tuần</h1><p>Dừng lại 10 phút để nhìn sự thật, giữ điều hiệu quả và bỏ bớt điều không còn phù hợp.</p></div><div className="week-badge"><span>TUẦN BẮT ĐẦU</span><strong>{niceDate(currentWeekStart, "")}</strong></div></section>
            <section className="review-snapshot"><article><span>VIỆC ĐÃ XONG</span><strong>{weekTasks.filter((task) => task.completed).length}<small>/{weekTasks.length}</small></strong><p>trong 7 ngày</p></article><article><span>NHỊP THÓI QUEN</span><strong>{habitRate}%</strong><p>{monthLogs.length} lần check-in tháng này</p></article><article><span>MỤC TIÊU TIẾN TRIỂN</span><strong>{openGoals.filter((goal) => goalTimeline(goal).progress > 0).length}</strong><p>mục tiêu đang có đà</p></article><article className="review-streak"><span>LỊCH SỬ REVIEW</span><strong>{reviews.length}</strong><p>tuần đã ghi lại</p></article></section>
            <section className="review-layout">
              <form className="review-form" id="review-form" key={currentReview?.updatedAt || currentWeekStart} onSubmit={submitReview}>
                <div className="review-form-head"><div><span>01</span><div><h2>Nhìn lại tuần này</h2><p>Viết ngắn, thật và cụ thể.</p></div></div><b>{currentReview ? "Đã lưu" : "Bản mới"}</b></div>
                <div className="review-fields"><label><span>Điều đã làm tốt</span><textarea name="wins" defaultValue={currentReview?.wins} placeholder="Chiến thắng, tiến bộ hoặc khoảnh khắc đáng ghi nhận..." /></label><label><span>Điều đang bị kẹt</span><textarea name="blockers" defaultValue={currentReview?.blockers} placeholder="Trở ngại, sự trì hoãn hay việc đã ùn lại..." /></label><label><span>Bài học rút ra</span><textarea name="lessons" defaultValue={currentReview?.lessons} placeholder="Điều gì nên tiếp tục, thay đổi hoặc dừng lại?" /></label><label><span>Một trọng tâm cho tuần tới</span><textarea name="nextFocus" defaultValue={currentReview?.nextFocus} placeholder="Nếu chỉ làm tốt một điều, đó sẽ là..." /></label></div>
                <fieldset className="energy-field"><legend>Mức năng lượng tuần này</legend><div>{[1,2,3,4,5].map((value) => <label key={value}><input type="radio" name="energy" value={value} defaultChecked={(currentReview?.energy || 3) === value} /><span>{value}</span><small>{["Cạn", "Thấp", "Ổn", "Tốt", "Rất tốt"][value - 1]}</small></label>)}</div></fieldset>
                <div className="review-submit"><p>Bạn có thể quay lại chỉnh sửa review này bất cứ lúc nào.</p><button disabled={saving}>{saving ? "Đang lưu..." : currentReview ? "Cập nhật review" : "Hoàn tất review"}</button></div>
              </form>
              <aside className="review-side"><section><p className="eyebrow">NGHI THỨC 10 PHÚT</p><h2>Một nhịp review đủ dùng.</h2><ol><li><b>2 phút</b><span>Nhìn số liệu, không phán xét.</span></li><li><b>4 phút</b><span>Ghi lại điều tốt và điểm kẹt.</span></li><li><b>2 phút</b><span>Rút ra một bài học.</span></li><li><b>2 phút</b><span>Chọn một trọng tâm tuần tới.</span></li></ol></section><section className="review-history"><div className="panel-head"><div><p className="eyebrow">LỊCH SỬ</p><h2>Các tuần trước</h2></div></div>{reviews.slice(0, 5).map((review) => <div className="review-history-row" key={review.id}><button title={review.nextFocus}><span><b>{niceDate(review.weekStart, "")}</b><small>{review.nextFocus || "Chưa ghi trọng tâm"}</small></span><em>{"●".repeat(review.energy)}{"○".repeat(5-review.energy)}</em></button><button className="review-delete" aria-label={`Xóa review tuần ${review.weekStart}`} onClick={() => remove("review", review.id)}>×</button></div>)}{!reviews.length && <p className="history-empty">Review đầu tiên sẽ xuất hiện ở đây.</p>}</section></aside>
            </section>
          </>}
        </>
      </div>
    </section>

    <nav className="mobile-nav" aria-label="Điều hướng di động">{nav.map((item) => <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => setSection(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>

    {modal === "task" && <ModalFrame title={editing?.kind === "task" ? "Chỉnh sửa việc" : "Việc mới"} eyebrow="HÀNH ĐỘNG CỤ THỂ" close={closeModal}><form onSubmit={submitTask}><Field label="Việc bạn sẽ làm"><input name="title" required defaultValue={editing?.kind === "task" ? editing.item.title : ""} placeholder="Ví dụ: Hoàn thành bản nháp đầu tiên" /></Field><Field label="Ghi chú"><textarea name="note" defaultValue={editing?.kind === "task" ? editing.item.note : ""} placeholder="Kết quả mong đợi hoặc bước tiếp theo..." /></Field><div className="form-row"><Field label="Mảng cuộc sống"><PlanSelect plans={plans} selected={editing?.kind === "task" ? editing.item.planId : planFilter} /></Field><Field label="Ngày thực hiện"><input name="dueDate" type="date" defaultValue={editing?.kind === "task" ? editing.item.dueDate || "" : taskDate || today} /></Field></div><Field label="Mức ưu tiên"><select name="priority" defaultValue={editing?.kind === "task" ? editing.item.priority : "normal"}><option value="low">Nhẹ nhàng</option><option value="normal">Bình thường</option><option value="high">Quan trọng</option></select></Field><FormActions saving={saving} close={closeModal} label={editing?.kind === "task" ? "Lưu thay đổi" : "Thêm vào tuần"} /></form></ModalFrame>}
    {modal === "habit" && <ModalFrame title={editing?.kind === "habit" ? "Chỉnh sửa thói quen" : "Thói quen mới"} eyebrow="HỆ THỐNG LẶP LẠI" close={closeModal}><form onSubmit={submitHabit}><Field label="Thói quen bạn muốn xây"><input name="name" required defaultValue={editing?.kind === "habit" ? editing.item.name : ""} placeholder="Ví dụ: Đi bộ 30 phút" /></Field><div className="form-row"><Field label="Thuộc mảng"><PlanSelect plans={plans} selected={editing?.kind === "habit" ? editing.item.planId : planFilter} /></Field><Field label="Tần suất mỗi tuần"><select name="targetPerWeek" defaultValue={editing?.kind === "habit" ? editing.item.targetPerWeek : "5"}>{[1,2,3,4,5,6,7].map((count) => <option value={count} key={count}>{count} ngày / tuần</option>)}</select></Field></div><ColorPicker selected={editing?.kind === "habit" ? editing.item.color : undefined} /><FormActions saving={saving} close={closeModal} label={editing?.kind === "habit" ? "Lưu thay đổi" : "Tạo thói quen"} /></form></ModalFrame>}
    {modal === "goal" && <ModalFrame title={editing?.kind === "goal" ? "Chỉnh sửa mục tiêu" : "Mục tiêu mới"} eyebrow="KẾT QUẢ CÓ THỂ ĐO" close={closeModal}><form onSubmit={submitGoal}><Field label="Kết quả bạn muốn đạt"><input name="title" required defaultValue={editing?.kind === "goal" ? editing.item.title : ""} placeholder="Ví dụ: Hoàn thành chứng chỉ tiếng Anh B2" /></Field><div className="form-row"><Field label="Thuộc mảng"><PlanSelect plans={plans} selected={editing?.kind === "goal" ? editing.item.planId : planFilter} /></Field><Field label="Ngày đích (Planary tự tính tiến độ)"><input name="targetDate" type="date" required min={today} defaultValue={editing?.kind === "goal" ? editing.item.targetDate || today : addDays(today, 100)} /></Field></div><div className="form-hint"><b>Tiến độ tự động:</b> Planary lấy hôm nay và ngày đích để chia đều nhịp theo từng ngày.</div><FormActions saving={saving} close={closeModal} label={editing?.kind === "goal" ? "Lưu thay đổi" : "Tạo mục tiêu"} /></form></ModalFrame>}
    {modal === "plan" && <ModalFrame title={editing?.kind === "plan" ? "Chỉnh sửa mảng" : "Mảng cuộc sống mới"} eyebrow="MỘT KHÔNG GIAN RIÊNG" close={closeModal} small><form onSubmit={submitPlan}><Field label="Tên mảng"><input name="name" required defaultValue={editing?.kind === "plan" ? editing.item.name : ""} placeholder="Ví dụ: Học tập" /></Field><ColorPicker selected={editing?.kind === "plan" ? editing.item.color : undefined} /><FormActions saving={saving} close={closeModal} label={editing?.kind === "plan" ? "Lưu thay đổi" : "Tạo mảng"} /></form></ModalFrame>}
    {modal === "bulkTask" && <ModalFrame title="Lặp kế hoạch theo tuần" eyebrow="LỊCH DÀI HẠN" close={closeModal}><form onSubmit={submitBulkTask}><Field label="Việc lặp lại"><input name="title" required placeholder="Ví dụ: Học tiếng Anh buổi sáng" /></Field><Field label="Ghi chú"><textarea name="note" placeholder="Nội dung buổi học hoặc mục tiêu nhỏ..." /></Field><div className="form-row"><Field label="Thuộc mảng"><PlanSelect plans={plans} selected={planFilter} /></Field><Field label="Lặp trong"><select name="weeks" defaultValue="4"><option value="4">1 tháng · 4 tuần</option><option value="6">1,5 tháng · 6 tuần</option><option value="8">2 tháng · 8 tuần</option><option value="12">3 tháng · 12 tuần</option></select></Field></div><fieldset className="weekday-picker"><legend>Ngày lặp trong tuần</legend><div>{["T2","T3","T4","T5","T6","T7","CN"].map((label, index) => <label key={label}><input type="checkbox" name="weekdays" value={index} defaultChecked={index === 0} /><span>{label}</span></label>)}</div></fieldset><Field label="Mức ưu tiên"><select name="priority" defaultValue="normal"><option value="low">Nhẹ nhàng</option><option value="normal">Bình thường</option><option value="high">Quan trọng</option></select></Field><div className="form-hint"><b>Bắt đầu từ:</b> tuần {niceDate(calendarWeekStart, "")}. Planary sẽ thêm lịch vào đúng các ngày bạn chọn.</div><FormActions saving={saving} close={closeModal} label="Tạo lịch lặp" /></form></ModalFrame>}
    {accountModal && <AccountUpgrade close={() => setAccountModal(false)} />}
  </main>;
}

function AuthScreen({ onBack }: { onBack?: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("auth_error") || "");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    if (mode === "register" && password !== String(form.get("confirmPassword") || "")) return setError("Hai mật khẩu chưa trùng khớp.");
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: mode, email: form.get("email"), password }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Không thể xác thực tài khoản.");
      window.location.assign("/");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể xác thực tài khoản."); }
    finally { setSaving(false); }
  }
  async function continueAsGuest() {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "guest" }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Không thể mở chế độ dùng nhanh.");
      window.location.assign("/");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể mở chế độ dùng nhanh."); }
    finally { setSaving(false); }
  }
  return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><span className="auth-mark">P</span><div><b>planary</b><small>PERSONAL SYSTEM</small></div></div><p className="eyebrow">KHÔNG GIAN CỦA RIÊNG BẠN</p><h1>{mode === "register" ? "Tạo không gian riêng tư." : "Chào mừng bạn trở lại."}</h1><p className="auth-copy">Dùng ngay trong vài giây, hoặc tạo tài khoản để giữ dữ liệu trên mọi thiết bị.</p>{error && <p className="auth-error" role="alert">{error}</p>}<button className="guest-submit" disabled={saving} onClick={continueAsGuest}>Dùng nhanh, không cần đăng nhập<small>Dữ liệu gắn với trình duyệt này</small></button><div className="auth-divider"><span>hoặc dùng tài khoản</span></div><form className="auth-form" onSubmit={submit}><label><span>Email</span><input required name="email" type="email" autoComplete="email" placeholder="ban@email.com" /></label><label><span>Mật khẩu</span><input required name="password" type="password" minLength={10} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Tối thiểu 10 ký tự" /></label>{mode === "register" && <label><span>Xác nhận mật khẩu</span><input required name="confirmPassword" type="password" minLength={10} autoComplete="new-password" placeholder="Nhập lại mật khẩu" /></label>}<button className="auth-submit" disabled={saving}>{saving ? "Đang xử lý..." : mode === "register" ? "Tạo tài khoản riêng" : "Đăng nhập"}</button></form><button className="auth-switch" onClick={() => { setMode((value) => value === "login" ? "register" : "login"); setError(""); }}>{mode === "register" ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký"}</button>{onBack && <button className="auth-back" onClick={onBack}>← Quay lại dùng nhanh</button>}<p className="auth-note">Một tài khoản email là đủ để giữ không gian Planary của bạn trên mọi thiết bị.</p></section></main>;
}

function MetricNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { current.current = value; const frame = requestAnimationFrame(() => setDisplay(value)); return () => cancelAnimationFrame(frame); }
    const from = current.current; const started = performance.now(); const duration = 720;
    let frame = 0;
    const tick = (now: number) => { const progress = Math.min(1, (now - started) / duration); const eased = 1 - Math.pow(1 - progress, 3); const next = Math.round(from + (value - from) * eased); current.current = next; setDisplay(next); if (progress < 1) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [value]);
  return <strong className="metric-number">{display}</strong>;
}

function DayNoteEditor({ date, initialValue, note, onSave, onDelete, onClose }: { date: string; initialValue: string; note?: DayNote; onSave: (date: string, content: string) => Promise<void>; onDelete: (note: DayNote) => Promise<void>; onClose: () => void }) {
  const [value, setValue] = useState(initialValue);
  const [savingNote, setSavingNote] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSavingNote(true);
    await onSave(date, value); setSavingNote(false); onClose();
  }
  return <form className="day-note" onSubmit={submit}><div><span>GHI CHÚ</span><button type="button" onClick={onClose}>×</button></div><textarea value={value} onChange={(event) => setValue(event.target.value)} placeholder="Ý định, việc cần nhớ hoặc một điều cho riêng hôm nay..." /><div className="day-note-actions">{note && <button className="day-note-delete" type="button" onClick={async () => { await onDelete(note); onClose(); }}>Xóa</button>}<button disabled={savingNote}>{savingNote ? "Đang lưu..." : "Lưu ghi chú"}</button></div></form>;
}

function AccountUpgrade({ close }: { close: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget); const password = String(form.get("password") || "");
    if (password !== String(form.get("confirmPassword") || "")) return setError("Hai mật khẩu chưa trùng khớp.");
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "register", email: form.get("email"), password }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Không thể tạo tài khoản.");
      window.location.assign("/");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tạo tài khoản."); }
    finally { setSaving(false); }
  }
  return <ModalFrame title="Giữ dữ liệu của bạn" eyebrow="NÂNG CẤP TỪ DÙNG NHANH" close={close} small><p className="account-upgrade-copy">Tạo tài khoản để đồng bộ không gian hiện tại trên các thiết bị. Dữ liệu bạn đã nhập vẫn ở nguyên đây.</p>{error && <p className="auth-error" role="alert">{error}</p>}<form onSubmit={submit}><Field label="Email"><input required name="email" type="email" autoComplete="email" placeholder="ban@email.com" /></Field><Field label="Mật khẩu"><input required name="password" type="password" minLength={10} autoComplete="new-password" placeholder="Tối thiểu 10 ký tự" /></Field><Field label="Xác nhận mật khẩu"><input required name="confirmPassword" type="password" minLength={10} autoComplete="new-password" placeholder="Nhập lại mật khẩu" /></Field><FormActions saving={saving} close={close} label="Tạo tài khoản & giữ dữ liệu" /></form></ModalFrame>;
}

function TaskList({ tasks, plans, today, onToggle, onRemove, empty }: { tasks: Task[]; plans: Plan[]; today: string; onToggle: (task: Task) => void; onRemove: (id: number) => void; empty: string }) {
  if (!tasks.length) return <div className="task-empty"><span>✓</span><p>{empty}</p></div>;
  return <div className="task-list">{tasks.map((task) => { const plan = plans.find((item) => item.id === task.planId); return <div className={`task-item ${task.completed ? "done" : ""}`} key={task.id}><button className="check" onClick={() => onToggle(task)}>{task.completed ? "✓" : ""}</button><div><strong>{task.title}</strong><span>{plan && <i style={{ background: palette[plan.color] || palette.sage }} />}{plan?.name || "Chung"}{task.dueDate && ` · ${task.dueDate === today ? "Hôm nay" : niceDate(task.dueDate, "")}`}</span></div>{task.priority === "high" && <b>QUAN TRỌNG</b>}<button className="delete" onClick={() => onRemove(task.id)}>×</button></div>})}</div>;
}
function ModalFrame({ title, eyebrow, close, children, small = false }: { title: string; eyebrow: string; close: () => void; children: React.ReactNode; small?: boolean }) {
  return <div className="modal-backdrop"><div className={`modal ${small ? "small" : ""}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button aria-label="Đóng" onClick={close}>×</button></div>{children}</div></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function PlanSelect({ plans, selected }: { plans: Plan[]; selected: number | null }) { return <select name="planId" defaultValue={selected || plans[0]?.id || ""}>{plans.map((plan) => <option value={plan.id} key={plan.id}>{plan.name}</option>)}</select>; }
function ColorPicker({ selected }: { selected?: string }) { return <fieldset className="color-field"><legend>Màu nhận diện</legend><div>{colorNames.map((color, index) => <label key={color}><span className="sr-only">Màu {color}</span><input type="radio" name="color" value={color} defaultChecked={selected ? selected === color : index === 0} /><span aria-hidden="true" style={{ background: palette[color] }} /></label>)}</div></fieldset>; }
function FormActions({ saving, close, label }: { saving: boolean; close: () => void; label: string }) { return <div className="form-actions"><button type="button" onClick={close}>Hủy</button><button className="submit" disabled={saving}>{saving ? "Đang lưu..." : label}</button></div>; }
