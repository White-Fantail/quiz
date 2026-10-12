# QuizDip — product phases and implementation status

**These phases are a plan, not a checklist of deployed functionality.** Always inspect actual code, migrations, credentials, permissions and end-to-end tests before announcing completion.

1. **Foundation:** Next.js TypeScript/Vercel app, Postgres/Prisma, auth and roles, shared Question/Answer/Clue/Media/Packs model and services, REST skeleton.
2. **Core gameplay:** incremental text/image clue reveal, server-side validation, game-dependent scoring, quiz packs, reliable session records.
3. **Open creation:** Studio without mandatory AI, editable metadata recommendations, low-friction general publishing, creator revisions, ratings/reports and moderation.
4. **ChatGPT/MCP:** authenticated Remote MCP, supported-type discovery, draft/edit/preview/publish, pack management, user-confirmed changes, audit and REST parity.
5. **Kids and multimodal:** independent affirmative Kids gate, image partial reveal, audio/video/map clues, age-appropriate UI, minimized children's data, personalized discovery.
6. **Community and quality:** creator reputation, dashboards and packs, clue-step analytics, AI suggestions for improvement, recommendations and new game formats.

**Current product direction (dev):** Discover-first content browsing with independently rated quiz packs, organic popularity/quality/difficulty rankings and explicitly labeled Admin Editor's Picks. Native Kids can browse and play separately approved quiz packs. **Weekly Five never launched** and its code/schema is removed through guarded migration `20261013040000_remove_unused_weekly_challenges`. Remaining work: production migrations, authenticated end-to-end tests and a trusted creator-verification policy if identity badges are later introduced. Quick random five is optional; continuous and full-pack play are central.

**Actual dev code:** Postgres schema/migrations, shared REST/MCP operations, Better Auth configuration, Cloudflare R2 media APIs, Admin editorial placements, independent Kids pack review routes and corresponding test scaffolding exist. **Not automatically ready to launch:** fully provisioned and E2E-verified Google/Apple/MCP OAuth, verified live R2 storage, automatic AI safety/genre classification and background classification workflows, final moderation operations, real assets and production legal/brand checks.

Next prioritize real create→preview→publish→play validation, OAuth and bucket verification, permissions and Kids safety, clue-quality improvement, and reliable release gates before new game types. See [product vision](product-principles.md), [architecture](architecture.md), [content policy](content-policy.md) and [clue design](clue-design.md).
