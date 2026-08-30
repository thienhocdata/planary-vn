import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Planary application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]+lang="vi"/i);
  assert.match(html, /<title>Planary — Từ mục tiêu đến nhịp sống<\/title>/);
  assert.match(html, /Hệ thống lập kế hoạch cá nhân/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/);
});

test("password KDF configuration is compatible and kept per account", async () => {
  const [auth, schema, database] = await Promise.all([
    readFile(new URL("../db/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
  ]);

  assert.match(auth, /const PASSWORD_ITERATIONS = 100_000;/);
  assert.match(auth, /passwordIterations: PASSWORD_ITERATIONS/);
  assert.match(auth, /const MIN_PASSWORD_ITERATIONS = 10_000;/);
  assert.match(auth, /function passwordIterationsForUser\(value: number \| null\)/);
  assert.match(auth, /const iterations = passwordIterationsForUser\(user\.passwordIterations\);/);
  assert.doesNotMatch(auth, /310_000/);
  assert.match(schema, /passwordIterations: integer\("password_iterations"\)\.notNull\(\)\.default\(100000\)/);
  assert.match(database, /password_iterations INTEGER NOT NULL DEFAULT 100000/);
  assert.match(database, /ALTER TABLE users ADD COLUMN password_iterations INTEGER NOT NULL DEFAULT 100000/);
});

test("weekly tasks retain a user-defined display order", async () => {
  const [page, route, schema, database] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/data/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /draggable aria-label=\{`Kéo để đổi thứ tự/);
  assert.match(page, /mode: "reorder", dueDate: date, timeSlot, taskIds/);
  assert.match(page, /sort\(\(left, right\) => left\.sortOrder - right\.sortOrder \|\| left\.id - right\.id\)/);
  assert.match(route, /body\.mode === "reorder"/);
  assert.match(route, /set\(\{ sortOrder \}\)/);
  assert.match(schema, /sortOrder: integer\("sort_order"\)\.notNull\(\)\.default\(0\)/);
  assert.match(database, /ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0/);
});

test("weekly schedule separates morning, afternoon, and evening", async () => {
  const [page, route, schema, database] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/data/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /label: "Sáng"/);
  assert.match(page, /label: "Chiều"/);
  assert.match(page, /label: "Tối"/);
  assert.match(page, /name="timeSlot"/);
  assert.match(route, /function taskTimeSlot\(value: unknown\)/);
  assert.match(route, /eq\(tasks\.timeSlot, timeSlot\)/);
  assert.match(schema, /timeSlot: text\("time_slot"\)\.notNull\(\)\.default\("morning"\)/);
  assert.match(database, /ALTER TABLE tasks ADD COLUMN time_slot TEXT NOT NULL DEFAULT 'morning'/);
});
