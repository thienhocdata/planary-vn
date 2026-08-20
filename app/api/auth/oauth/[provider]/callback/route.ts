import { completeOAuth } from "../../../../../../db/auth";

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  const destination = new URL("/", request.url);
  try {
    if (destination.searchParams.get("error")) throw new Error("Bạn đã hủy đăng nhập hoặc nền tảng không chấp nhận yêu cầu.");
    const result = await completeOAuth(request, provider);
    const response = Response.redirect(destination, 302);
    response.headers.set("set-cookie", result.cookie);
    return response;
  } catch (error) {
    destination.searchParams.set("auth_error", error instanceof Error ? error.message : "Không thể hoàn tất đăng nhập.");
    return Response.redirect(destination, 302);
  }
}
