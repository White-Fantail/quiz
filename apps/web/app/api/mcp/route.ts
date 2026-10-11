/**
 * Reserved for the future authenticated Remote MCP transport.
 * This endpoint deliberately exposes no tools, user data, or mutations.
 */
function unavailable() {
  return Response.json(
    { error: "not_implemented", message: "Clupio Remote MCP is not available yet." },
    { status: 501, headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = unavailable;
export const POST = unavailable;
