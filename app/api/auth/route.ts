import { continueAsGuest, getCurrentUser, loginWithPassword, logout, registerWithPassword } from "../../../db/auth";

function message(error: unknown) {
  return error instanceof Error ? error.message : "Không thể xác thực tài khoản.";
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ user: null }, { status: 401 });
    return Response.json({ user });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: string; email?: string; password?: string };
    if (body.action === "logout") {
      return Response.json({ ok: true }, { headers: { "set-cookie": await logout(request) } });
    }
    if (body.action === "guest") {
      const result = await continueAsGuest(request);
      return Response.json({ user: result.user }, { status: 201, headers: { "set-cookie": result.cookie } });
    }
    if (body.action !== "login" && body.action !== "register") return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
    const email = String(body.email || "");
    const password = String(body.password || "");
    const currentUser = body.action === "register" ? await getCurrentUser(request) : null;
    const result = body.action === "register" ? await registerWithPassword(request, email, password, currentUser?.provider === "guest" ? currentUser.id : undefined) : await loginWithPassword(request, email, password);
    return Response.json({ user: result.user }, { status: body.action === "register" ? 201 : 200, headers: { "set-cookie": result.cookie } });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 400 });
  }
}
