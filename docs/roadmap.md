# QuizDip — product phases and implementation status

**These phases are a plan, not a checklist of deployed functionality.** Always inspect actual code, migrations, credentials, permissions and end-to-end tests before announcing completion.

1. **Foundation:** Next.js TypeScript/Vercel app, Postgres/Prisma, auth and roles, shared Question/Answer/Clue/Media/Packs model and services, REST skeleton.
2. **Core gameplay:** incremental text/image clue reveal, server-side validation, game-dependent scoring, quiz packs, reliable session records.
3. **Open creation:** Studio without mandatory AI, editable metadata recommendations, low-friction general publishing, creator revisions, ratings/reports and moderation.
4. **ChatGPT/MCP:** authenticated Remote MCP, supported-type discovery, draft/edit/preview/publish, pack management, user-confirmed changes, audit and REST parity.
5. **Kids and multimodal:** independent affirmative Kids gate, image partial reveal, audio/video/map clues, age-appropriate UI, minimized children's data, personalized discovery.
6. **Community and quality:** creator reputation, dashboards and packs, clue-step analytics, AI suggestions for improvement, recommendations and new game formats.

**Current extra product direction:** Discovery-first content browsing with editorially selected quizzes/packs and data-based popularity, quality and difficulty replaces new Weekly Five challenges. Quick random-five is an optional introduction; continuous practice and full-pack play are central. The previous Weekly Five implementation remains available for archival compatibility while being retired in phases.

**Actual dev code:** Postgres schema/migrations, shared REST/MCP operations, Better Auth configuration, Cloudflare R2 media APIs, editorial weekly challenges, manual Admin review routes and corresponding test scaffolding exist. **Not automatically ready to launch:** fully provisioned and E2E-verified Google/Apple/MCP OAuth, verified live R2 storage, automatic AI safety/genre classification and background classification workflows, final moderation operations, real assets and production legal/brand checks.

Next prioritize real create→preview→publish→play validation, OAuth and bucket verification, permissions and Kids safety, clue-quality improvement, and reliable release gates before new game types. See [product vision](product-principles.md), [architecture](architecture.md), [content policy](content-policy.md) and [clue design](clue-design.md).
