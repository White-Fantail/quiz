import { auth } from "../../../../src/lib/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const target = new URL("/api/auth/.well-known/oauth-protected-resource", request.url);
  return auth.handler(new Request(target, { headers: request.headers }));
}
