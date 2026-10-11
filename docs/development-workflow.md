# QuizDip — AI developer workflow and Git conventions

## Authoritative sources

Canonical repo: https://github.com/White-Fantail/quizdip. Every agent begins at [AGENTS.md](../AGENTS.md), then consults [product vision](product-principles.md), [clue design](clue-design.md), [content/safety policy](content-policy.md), [creator workflows](creator-workflows.md), [brand](brand.md) and [architecture](architecture.md). For existing contracts also read [REST/MCP](api-mcp.md), [OAuth](auth-sso-mcp.md), [media](media-r2.md), [play modes](play-modes.md), [quiz metadata](quiz-metadata.md) and [roadmap](roadmap.md).

The product and child-safety constraints take priority over playful branding. Current implementation and migration compatibility take priority over obsolete technical examples. Plans and UI proposals are **not** evidence of shipped or verified features.

## Branches and merges

- **dev** is the default development/integration branch; develop, validate, commit and push there.
- **main** is stable and may only advance at the user's **explicit** request.
- All merges are **fast-forward only** (git merge --ff-only). No merge commit, squash, --no-ff or forced shared-history rewriting.
- If ancestry diverges, inspect and reconcile safely before trying again. Never claim an unexecuted merge or push succeeded.

## Checklist for every implementation

1. Check the branch, head and pending changes. Understand the existing services, schema, UI, tests and root cause of a bug before editing.
2. Build the smallest coherent vertical feature without speculative FastAPI, early microservices, or copied domain rules in UI or MCP adapters.
3. For behavior changes, update Prisma schema/migration where applicable, **shared service**, validated input/output contracts, REST route, authorized MCP tool, UI, relevant docs and parity/regression tests **together**. Document any intentionally restricted MCP capability.
4. Enforce server-side account/ownership/Admin authorization, private assets and answers, publish state, Kids safety, revision pins, session signing, rankings privacy, audit and abuse protection.
5. Maintain low-friction creator intent, optional AI classification suggestions and separate trusted child-safety eligibility. A successful general publication is not child-safe approval.
6. Run relevant tests, npm test, typecheck and build if dependencies and environment permit. Run real dev OAuth/R2 E2E when those integrations change; disclose all unexecuted checks.
7. Commit on dev; only fast-forward main after a later explicit user instruction. Report changed files, REST operations, MCP tools, actual tests, remaining risks, commit SHA and branch state.

## Naming and compatibility

**QuizDip / 퀴즈딥** is the only public brand. Package/workspace scopes are **@quizdip/*** and MCP tools start **quizdip_**. Never introduce a retired product name in new identifiers, UI, API names, copy or documentation.

A **legacy v1 signing-domain string** inside signed play tokens is intentionally immutable for existing-session compatibility; renaming that value requires a versioned migration and passing token-compatibility tests. This is not customer branding and must not appear in marketing or product UI. Likewise changes to local DB defaults or example R2 bucket names do **not** migrate live infrastructure, OAuth settings or stored objects. Validate those independently.

## Release safety

Do not claim full Google/Apple OAuth, private R2 upload, AI categorization, automatic Kids review or production-ready Admin solely because code exists. Reproduce the real integrated flow under dev credentials, review authenticated MCP access and REST parity, and check safety regressions before declaring the feature operational.
