"use client";

import { useMemo, useState } from "react";

type Status = "Hoàn thành" | "Đang làm" | "Sắp tới" | "Bị chặn";
type Task = { id: number; title: string; owner: string; due: string; status: Status; progress: number; tag: string };

const initialTasks: Task[] = [
  { id: 1, title: "Chốt phạm vi và mục tiêu", owner: "Minh", due: "08/08", status: "Hoàn thành", progress: 100, tag: "Chiến lược" },
  { id: 2, title: "Thiết kế luồng trải nghiệm", owner: "Lan", due: "12/08", status: "Đang làm", progress: 72, tag: "Thiết kế" },
  { id: 3, title: "Xây dựng dashboard MVP", owner: "Quang", due: "15/08", status: "Đang làm", progress: 48, tag: "Sản phẩm" },
  { id: 4, title: "Kiểm thử với nhóm nội bộ", owner: "Hà", due: "18/08", status: "Sắp tới", progress: 10, tag: "Nghiên cứu" },
  { id: 5, title: "Kết nối dữ liệu báo cáo", owner: "Quang", due: "19/08", status: "Bị chặn", progress: 32, tag: "Kỹ thuật" },
  { id: 6, title: "Phát hành phiên bản beta", owner: "Minh", due: "23/08", status: "Sắp tới", progress: 0, tag: "Ra mắt" },
];

const filters = ["Tất cả", "Đang làm", "Sắp tới", "Hoàn thành", "Bị chặn"] as const;

export default function Home() {
  const [tasks, setTasks] = useState(initialTasks);
  const [filter, setFilter] = useState<(typeof filters)[number]>("Tất cả");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState(false);

  const shown = useMemo(() => tasks.filter(t =>
    (filter === "Tất cả" || t.status === filter) && t.title.toLowerCase().includes(search.toLowerCase())
  ), [tasks, filter, search]);
  const overall = Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length);

  function cycleStatus(id: number) {
    const order: Status[] = ["Sắp tới", "Đang làm", "Hoàn thành"];
    setTasks(items => items.map(t => {
      if (t.id !== id || t.status === "Bị chặn") return t;
      const next = order[(order.indexOf(t.status) + 1) % order.length];
      return { ...t, status: next, progress: next === "Hoàn thành" ? 100 : next === "Đang làm" ? Math.max(t.progress, 35) : 0 };
    }));
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#" aria-label="Planary trang chủ"><span className="brand-mark">P</span> planary</a>
        <nav aria-label="Điều hướng chính"><a className="active" href="#overview">Tổng quan</a><a href="#tasks">Công việc</a><a href="#timeline">Lịch trình</a></nav>
        <div className="header-actions"><button className="icon-btn" aria-label="Thông báo">●</button><div className="avatar">MN</div></div>
      </header>

      <section className="hero" id="overview">
        <div><p className="eyebrow">KHÔNG GIAN LÀM VIỆC / SẢN PHẨM</p><h1>Chào buổi sáng, Minh.</h1><p>Mọi việc vẫn đang đúng hướng. Hôm nay hãy tập trung vào 3 công việc quan trọng.</p></div>
        <button className="primary" onClick={() => setNotice(true)}><span>+</span> Thêm công việc</button>
      </section>

      <section className="stats" aria-label="Thống kê kế hoạch">
        <article><span>TIẾN ĐỘ TỔNG</span><strong>{overall}%</strong><div className="bar"><i style={{ width: `${overall}%` }} /></div><small><b>+8%</b> so với tuần trước</small></article>
        <article><span>CÔNG VIỆC ĐANG LÀM</span><strong>{tasks.filter(t => t.status === "Đang làm").length}<em>/ {tasks.length}</em></strong><small>2 việc cần hoàn thành tuần này</small></article>
        <article><span>THỜI GIAN CÒN LẠI</span><strong>14 <em>ngày</em></strong><small>Hạn cuối: 23 tháng 8, 2026</small></article>
        <article className="health"><span>SỨC KHỎ KẾ HOẠCH</span><strong><i /> Tốt</strong><small>Không có rủi ro nghiêm trọng</small></article>
      </section>

      <section className="workspace" id="tasks">
        <div className="section-head"><div><p className="eyebrow">TIẾN ĐỘ THỰC TẾ</p><h2>Công việc trong kế hoạch</h2></div><label className="search"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm công việc..." /></label></div>
        <div className="filters" role="group" aria-label="Lọc theo trạng thái">{filters.map(f => <button key={f} className={filter === f ? "selected" : ""} onClick={() => setFilter(f)}>{f}{f === "Tất cả" && <span>{tasks.length}</span>}</button>)}</div>
        <div className="task-table">
          <div className="task-row table-head"><span>CÔNG VIỆC</span><span>NGƯỜI PHỤ TRÁCH</span><span>HẠN</span><span>TIẾN ĐỘ</span><span>TRẠNG THÁI</span></div>
          {shown.map(task => <div className="task-row" key={task.id}>
            <div className="task-name"><button className="check" onClick={() => cycleStatus(task.id)} aria-label={`Chuyển trạng thái ${task.title}`}>{task.status === "Hoàn thành" ? "✓" : ""}</button><div><b>{task.title}</b><small>{task.tag}</small></div></div>
            <div className="owner"><span>{task.owner.slice(0, 1)}</span>{task.owner}</div><time>{task.due}</time>
            <div className="progress"><span><i style={{ width: `${task.progress}%` }} /></span><b>{task.progress}%</b></div>
            <button className={`status ${task.status.replace(" ", "-").toLowerCase()}`} onClick={() => cycleStatus(task.id)}>{task.status}</button>
          </div>)}
          {!shown.length && <div className="empty">Không tìm thấy công việc phù hợp.</div>}
        </div>
      </section>

      <section className="timeline" id="timeline"><div><p className="eyebrow">CỘT MỐC SẮP TỚI</p><h2>Lịch trình tháng 8</h2></div><div className="milestones"><article className="done"><b>08</b><span>THÁNG 8</span><p>Khởi động</p></article><i /><article className="current"><b>15</b><span>THÁNG 8</span><p>Hoàn tất MVP</p></article><i /><article><b>18</b><span>THÁNG 8</span><p>Kiểm thử</p></article><i /><article><b>23</b><span>THÁNG 8</span><p>Ra mắt beta</p></article></div></section>

      {notice && <div className="toast" role="status">Tính năng thêm công việc sẽ được kết nối với dữ liệu của bạn.<button onClick={() => setNotice(false)} aria-label="Đóng">×</button></div>}
    </main>
  );
}
