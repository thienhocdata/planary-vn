import { beginOAuth } from "../../../../../db/auth";

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  try {
    return Response.redirect(await beginOAuth(request, provider), 302);
  } catch (error) {
    const destination = new URL("/", request.url);
    destination.searchParams.set("auth_error", error instanceof Error ? error.message : "Không thể bắt đầu đăng nhập.");
    return Response.redirect(destination, 302);
  }
}
