# Remote MCP server — planned

Clupio Connect will expose authenticated Remote MCP tools for drafting, editing, previewing, publishing and managing quizzes using the **same** backend and policy layer as the web app.

This folder is currently documentation only. **There is no running MCP endpoint**, OAuth integration or external publish permission yet.

Before implementing:
1. Define real content persistence and author identity/authorization.
2. Add server-side validation for public publishing and Kids safety decisions.
3. Support explicit user confirmation and sensible rate limits for AI-assisted publishing.
4. Build an authenticated Remote MCP transport which calls the shared API.
5. Test cross-user isolation, duplicate publishing, idempotency and auditability.
