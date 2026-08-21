import { and, count, eq, gt } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { ensureDb, getDb } from ".";
import { authIdentities, dayNotes, goals, habitLogs, habits, oauthStates, plans, sessions, tasks, users, weeklyReviews } from "./schema";

const SESSION_COOKIE = "planary_session";
const SESSION_DAYS = 30;
const OAUTH_STATE_MINUTES = 10;
const PASSWORD_ITERATIONS = 100_000;
const MIN_PASSWORD_ITERATIONS = 10_000;
const encoder = new TextEncoder();

export type AuthUser = { id: number; email: string | null; displayName: string; provider: string };
type Provider = "facebook" | "github" | "google";
type OAuthConfig = { clientId: string; clientSecret: string; redirectUri: string };

function base64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64Url(bytes: Uint8Array) {
  return base64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomToken() {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return base64(new Uint8Array(bytes));
}

async function passwordDigest(password: string, salt: Uint8Array, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return base64(new Uint8Array(bits));
}

function passwordIterationsForUser(value: number | null) {
  if (value === null) return PASSWORD_ITERATIONS;
  if (!Number.isInteger(value) || value < MIN_PASSWORD_ITERATIONS || value > PASSWORD_ITERATIONS) {
    throw new Error("Tài khoản này dùng cấu hình mật khẩu không còn được hỗ trợ. Hãy đặt lại mật khẩu để tiếp tục.");
  }
  return value;
}

function safeEqual(left: string, right: string) {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index] ^ rightBytes[index];
  return difference === 0;
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Email không hợp lệ.");
  return email;
}

function assertPassword(value: string) {
  if (value.length < 10) throw new Error("Mật khẩu cần ít nhất 10 ký tự.");
  if (value.length > 128) throw new Error("Mật khẩu quá dài.");
}

function displayNameForEmail(email: string) {
  return email.split("@")[0] || "Bạn";
}

function readCookie(request: Request, name: string) {
  const entry = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

function sessionCookie(token: string, request: Request, expiresAt: string) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const maxAge = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${maxAge}`;
}

function expiredSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`;
}

function asAuthUser(user: typeof users.$inferSelect, provider: string): AuthUser {
  return { id: user.id, email: user.email, displayName: user.displayName, provider };
}

async function claimLegacyData(userId: number) {
  const db = getDb();
  const [{ total }] = await db.select({ total: count() }).from(users);
  if (total !== 1) return;
  await Promise.all([
    db.update(plans).set({ userId }).where(eq(plans.userId, null)),
    db.update(tasks).set({ userId }).where(eq(tasks.userId, null)),
    db.update(goals).set({ userId }).where(eq(goals.userId, null)),
    db.update(habits).set({ userId }).where(eq(habits.userId, null)),
    db.update(habitLogs).set({ userId }).where(eq(habitLogs.userId, null)),
    db.update(weeklyReviews).set({ userId }).where(eq(weeklyReviews.userId, null)),
    db.update(dayNotes).set({ userId }).where(eq(dayNotes.userId, null)),
  ]);
}

async function createSession(userId: number, request: Request) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const db = getDb();
  await db.insert(sessions).values({ userId, tokenHash: await digest(token), expiresAt });
  return sessionCookie(token, request, expiresAt);
}

async function userFromSession(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const db = getDb();
  const [match] = await db.select({ user: users }).from(sessions).innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, await digest(token)), gt(sessions.expiresAt, new Date().toISOString()))).limit(1);
  return match ? asAuthUser(match.user, match.user.email ? "password" : "guest") : null;
}

export async function getCurrentUser(request: Request) {
  await ensureDb();
  return await userFromSession(request);
}

export async function continueAsGuest(request: Request) {
  await ensureDb();
  const db = getDb();
  const [user] = await db.insert(users).values({ displayName: "Khách" }).returning();
  return { user: asAuthUser(user, "guest"), cookie: await createSession(user.id, request) };
}

export async function registerWithPassword(request: Request, emailInput: string, password: string, upgradeUserId?: number) {
  await ensureDb();
  const email = normalizeEmail(emailInput);
  assertPassword(password);
  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw new Error("Email này đã có tài khoản. Hãy đăng nhập.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordSalt = base64(salt);
  const passwordHash = await passwordDigest(password, salt, PASSWORD_ITERATIONS);
  const [user] = upgradeUserId
    ? await db.update(users).set({ email, displayName: displayNameForEmail(email), passwordSalt, passwordHash, passwordIterations: PASSWORD_ITERATIONS, updatedAt: new Date().toISOString() }).where(eq(users.id, upgradeUserId)).returning()
    : await db.insert(users).values({ email, displayName: displayNameForEmail(email), passwordSalt, passwordHash, passwordIterations: PASSWORD_ITERATIONS }).returning();
  if (!upgradeUserId) await claimLegacyData(user.id);
  return { user: asAuthUser(user, "password"), cookie: await createSession(user.id, request) };
}

export async function loginWithPassword(request: Request, emailInput: string, password: string) {
  await ensureDb();
  const email = normalizeEmail(emailInput);
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user?.passwordHash || !user.passwordSalt) throw new Error("Email hoặc mật khẩu chưa đúng.");
  const iterations = passwordIterationsForUser(user.passwordIterations);
  const computed = await passwordDigest(password, fromBase64(user.passwordSalt), iterations);
  if (!safeEqual(computed, user.passwordHash)) throw new Error("Email hoặc mật khẩu chưa đúng.");
  return { user: asAuthUser(user, "password"), cookie: await createSession(user.id, request) };
}

export async function logout(request: Request) {
  await ensureDb();
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, await digest(token)));
  return expiredSessionCookie(request);
}

function setting(name: string) {
  const value = (env as unknown as Record<string, unknown>)[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function oauthConfig(provider: Provider, request: Request): OAuthConfig | null {
  const prefix = `OAUTH_${provider.toUpperCase()}`;
  const clientId = setting(`${prefix}_CLIENT_ID`);
  const clientSecret = setting(`${prefix}_CLIENT_SECRET`);
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri: setting(`${prefix}_REDIRECT_URI`) || `${new URL(request.url).origin}/api/auth/oauth/${provider}/callback` };
}

function isProvider(value: string): value is Provider {
  return value === "facebook" || value === "github" || value === "google";
}

export async function beginOAuth(request: Request, providerInput: string) {
  if (!isProvider(providerInput)) throw new Error("Nền tảng đăng nhập không được hỗ trợ.");
  await ensureDb();
  const config = oauthConfig(providerInput, request);
  if (!config) throw new Error(`Đăng nhập ${providerInput === "facebook" ? "Facebook" : providerInput === "google" ? "Google" : "GitHub"} chưa được cấu hình.`);
  const state = randomToken();
  const expiresAt = new Date(Date.now() + OAUTH_STATE_MINUTES * 60 * 1000).toISOString();
  await getDb().insert(oauthStates).values({ stateHash: await digest(state), provider: providerInput, expiresAt });
  const url = new URL(providerInput === "facebook" ? "https://www.facebook.com/v21.0/dialog/oauth" : providerInput === "google" ? "https://accounts.google.com/o/oauth2/v2/auth" : "https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", providerInput === "facebook" ? "email,public_profile" : providerInput === "google" ? "openid email profile" : "read:user user:email");
  return url.toString();
}

async function tokenFor(provider: Provider, config: OAuthConfig, code: string) {
  const endpoint = provider === "facebook" ? "https://graph.facebook.com/v21.0/oauth/access_token" : provider === "google" ? "https://oauth2.googleapis.com/token" : "https://github.com/login/oauth/access_token";
  const body = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, code });
  if (provider === "google") body.set("grant_type", "authorization_code");
  const response = await fetch(endpoint, { method: "POST", headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" }, body });
  const data = await response.json() as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "Không thể xác thực với nền tảng đã chọn.");
  return data.access_token;
}

async function profileFor(provider: Provider, token: string) {
  if (provider === "facebook") {
    const response = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(token)}`);
    const data = await response.json() as { id?: string; name?: string; email?: string };
    if (!response.ok || !data.id) throw new Error("Facebook không trả về thông tin tài khoản.");
    return { id: data.id, email: data.email ? normalizeEmail(data.email) : null, displayName: data.name || "Người dùng Facebook" };
  }
  if (provider === "google") {
    const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${token}` } });
    const data = await response.json() as { sub?: string; name?: string; email?: string };
    if (!response.ok || !data.sub) throw new Error("Google không trả về thông tin tài khoản.");
    return { id: data.sub, email: data.email ? normalizeEmail(data.email) : null, displayName: data.name || "Người dùng Google" };
  }
  const [profileResponse, emailsResponse] = await Promise.all([
    fetch("https://api.github.com/user", { headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}` } }),
    fetch("https://api.github.com/user/emails", { headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}` } }),
  ]);
  const profile = await profileResponse.json() as { id?: number; login?: string; name?: string; email?: string };
  const emails = emailsResponse.ok ? await emailsResponse.json() as Array<{ email: string; primary: boolean; verified: boolean }> : [];
  const primary = profile.email || emails.find((item) => item.primary && item.verified)?.email || null;
  if (!profileResponse.ok || !profile.id) throw new Error("GitHub không trả về thông tin tài khoản.");
  return { id: String(profile.id), email: primary ? normalizeEmail(primary) : null, displayName: profile.name || profile.login || "Người dùng GitHub" };
}

export async function completeOAuth(request: Request, providerInput: string) {
  if (!isProvider(providerInput)) throw new Error("Nền tảng đăng nhập không được hỗ trợ.");
  await ensureDb();
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!state || !code) throw new Error("Phiên đăng nhập đã hết hạn hoặc bị từ chối.");
  const db = getDb();
  const [savedState] = await db.select().from(oauthStates).where(and(eq(oauthStates.stateHash, await digest(state)), eq(oauthStates.provider, providerInput), gt(oauthStates.expiresAt, new Date().toISOString()))).limit(1);
  if (!savedState) throw new Error("Phiên đăng nhập không còn hợp lệ. Hãy thử lại.");
  await db.delete(oauthStates).where(eq(oauthStates.id, savedState.id));
  const config = oauthConfig(providerInput, request);
  if (!config) throw new Error("Nền tảng đăng nhập chưa được cấu hình.");
  const profile = await profileFor(providerInput, await tokenFor(providerInput, config, code));
  const [knownIdentity] = await db.select().from(authIdentities).where(and(eq(authIdentities.provider, providerInput), eq(authIdentities.providerAccountId, profile.id))).limit(1);
  let user: typeof users.$inferSelect;
  if (knownIdentity) {
    const [existing] = await db.select().from(users).where(eq(users.id, knownIdentity.userId)).limit(1);
    if (!existing) throw new Error("Tài khoản không còn tồn tại.");
    user = existing;
  } else {
    const [emailUser] = profile.email ? await db.select().from(users).where(eq(users.email, profile.email)).limit(1) : [];
    [user] = emailUser ? [emailUser] : await db.insert(users).values({ email: profile.email, displayName: profile.displayName }).returning();
    await db.insert(authIdentities).values({ userId: user.id, provider: providerInput, providerAccountId: profile.id }).onConflictDoNothing();
    await claimLegacyData(user.id);
  }
  return { user: asAuthUser(user, providerInput), cookie: await createSession(user.id, request) };
}
