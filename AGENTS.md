# Development instructions — Clupio

## Product intent
Clupio is a playful open quiz platform: people follow progressive clues, discover answers, and create/share their own quizzes. Official brand: **Clupio (클루피오)**; repo name stays `quiz`.

## Non-negotiable rules
1. **Develop on `dev`**. Do not modify/merge `main` unless the user explicitly asks.
2. Integrations between branches must be **fast-forward only**. Never use merge commits, squash merging, or force-push shared branch history.
3. Keep creator intent, AI recommendations/difficulty, and platform-controlled safety **separate**.
4. Creators must **never** be able to set or override platform safety decisions.
5. Publishing ordinary content should be low-friction, subject to automatic anti-abuse and safety controls. **Kids eligibility requires affirmative platform approval**; pending or uncertain content must be hidden from Kids.
6. Implement one shared domain and business-policy layer; web and MCP must not duplicate publication/moderation authorization logic.
7. Support multimodal clue types and multiple game rules without imposing one fixed clue count or scoring model.
8. Never state that unimplemented or untested AI, authentication, DB, MCP, or Kids moderation exists.
9. Prioritize privacy/minimal collection for minors, accessibility, factual accuracy and fair treatment of political/historical content.
10. Implement in small steps, add tests, and verify types/build/regressions where tooling is available.

## Brand
Main: #6255E8; mint: #52D8B4; yellow: #FFD36E; coral: #FF8D83; ink: #252642; canvas: #F8F7FC. Core areas: Play, Discover, Studio. Kids is a mode, not a second platform. The Pio mascot is conceptual; do not invent an approved official asset.

## Status
This initial repository is only a scaffold with a local sample game. Read docs/roadmap.md for planned features.
