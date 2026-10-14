# QuizDip play modes (current)

**Source of truth:** [Discovery-first platform design](discovery-first-platform-design.md).

QuizDip has three first-class run modes:

| Mode | Content | Completion | Resume |
| --- | --- | --- | --- |
| `RANDOM_FIVE` | Five previously unseen eligible questions chosen from the requested locale | After five completed rounds | Server run capability; signed-in progress |
| `INFINITE` | Consecutive eligible questions without repeating already-seen content | When stopped or the unseen pool is exhausted | Server run capability; signed-in progress |
| `PACK` | Every eligible member of a creator-authored quiz pack, with pinned localized published revisions | After its final member (variable length) | Signed-in across devices, guest same-tab capability |

Creators can set a pack's `orderMode` to `CREATOR` (default) or `RANDOM`. Random packs shuffle **once** per new run and store that complete permutation with immutable revision IDs. Resuming never reshuffles. Pack creation, editing, preview and publication happen through Studio and shared REST/MCP services.

## Eligibility and safety

- The public `GENERAL` lane accepts only published, localized, non-restricted questions with playable media. It checks moderation and publication when selecting and downloading playable questions; clue reveals and guesses run locally.
- Native Kids requires a parent-approved device and a guardian-pinned child profile. Every question, version, media item and entire pack must pass Kids safety eligibility. Child progress never participates in public ratings or leaderboards.
- `PlayRun`, `PlayRunQuestion` and `PlaySession` remain stored history. The downloaded order/revisions are server-selected; local scoring is intentionally trusted as a casual-game record. Batch results are idempotent, not anti-cheat verified.
- Children cannot access general audience features by passing a different lane; adult REST/MCP endpoints never accept native Kids bearer tokens.

## Feedback and discovery

- After a completed five-question run, rate questions on the result screen. One-off Discover questions can be rated as soon as they finish.
- After each scored question, players can optionally reveal unused text, map, image, audio and video clues without changing their score. The signed session token grants read-only review of that question’s pinned revision only after `SOLVED` or `FAILED`; the downloadable play bundle intentionally contains all clues and answer keys; UI still reveals clues progressively.
- Full packs have separate completion-gated pack feedback, reports and creator performance analytics, independently of question reviews.
- Discover highlights evidence-based popularity, quality and difficulty separately from explicit, ADMIN-selected `Editor's Pick` placements.

## Keyboard-first browser play

Web pack runs, random/continuous runs, and single-quiz pages display multiple-choice options as 1–N instead of A–D. Pressing the corresponding number-row or numpad key **selects only**; pressing Enter then submits the selected option, matching the free-text Enter-to-submit flow. The number shortcut is ignored during IME composition, while typing into editable controls, after a finished question, and while a response is pending or a new clue is required. Number-pad navigation with Num Lock off does not count as an answer. Mouse/touch choices retain the visible selection and separate Check Answer button; free-text questions are unchanged. A number shortcut moves focus to the answer form so pressing Enter cannot activate an older, focused option button. Enter on a focused option selects it first, and submits only when that option is already selected.

Enter remains Check Answer (or next clue when no answer is selected), and advances to the next question/results after grading. Ctrl/Cmd+Enter reveals the next clue or advances after grading. This is client-side input behavior only: scoring and answer evaluation remain server-authoritative; no REST/MCP operations or persisted schema changes.

## Removed Weekly Five

The previously proposed recurring weekly challenge **was never launched**. The challenge proposal/schedule, special standings, associated routes and MCP operations are removed. Migration `20261013040000_remove_unused_weekly_challenges` drops the unused weekly tables, `PlayRun.weeklyId`, and `PlayRun.officialEligible`, with a fail-closed guard that refuses to drop those objects if any weekly records or runs exist.

Do not reintroduce weekly modes, weekly reservations, fixed-five editorial constraints, or user-visible weekly competition pages without a new product decision.

## Rollout

New production migrations are run by the main-branch deployment build plan, not automatically by development CI. Before main deployment, confirm migration order and apply migrations against a staging database snapshot; manually test complete `RANDOM_FIVE`, `INFINITE`, `PACK`, and child-device playback with real published revisions and approved media.


## Shareable web pack results

After the web player finishes a **PACK** run, the result screen creates a portrait PNG card (1080 × 1350) showing the localized pack title, the run's reported total score, number correct, number completed, and QuizDip branding. The card includes the public pack URL as readable text; **no QR code is used**. A Share Result button uses browser-native Web Share (PNG + message + public pack URL when supported), while Save Image and Copy Pack Link are always visible fallbacks. Some share targets discard URLs sent alongside image files, so the UI explicitly prompts players to copy the link when necessary. Desktop browsers without file sharing can still save the image and copy the link.

The exported image is a visual recap, **not a verified leaderboard claim**. Scores originate from an already completed server-authoritative run; client-generated cards cannot edit those records. Do not expose run/session tokens, unrevealed clues, answer keys or private links. Only public pack detail URLs are used. Sharing is a browser-only formatting/action feature with **no new REST operations or MCP tools**; the existing authoritative `run_current` result and `pack_get` are unchanged. There is no database migration or media upload and no server-side publication of player results.

## Local-first runtime (October 2026)

Finite `PACK` and `RANDOM_FIVE` runs download pinned question revisions, all clue metadata and answer keys through `local_run_bundle`. A shared deterministic `@quizdip/domain` reducer immediately reveals clues, checks answers and computes existing scores. The player uses `local_run_sync` to store completed rounds in batches, with idempotency keyed to run position. Standalone questions use `local_single_start` and `local_single_sync`. `INFINITE` retains incremental server selection. Short-lived signed media URLs are resolved separately on demand without a clue-reveal server step.

Local state persists on web; native saves compact progress with SecureStore and re-downloads the bundle on re-open. Native device time limits are advisory, counted from foreground use. The system does not claim competitive-grade integrity or fully offline media playback. Keep legacy per-clue/per-guess operations until installed older clients no longer require them.
