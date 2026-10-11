import { auth } from "../../src/lib/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Forward the request to the metadata produced by the SAME configured OAuth server.
export async function GET(request: Request) {
  const target = new URL("/api/auth/.well-known/oauth-protected-resource", request.url);
  return auth.handler(new Request(target, { headers: request.headers }));
}
