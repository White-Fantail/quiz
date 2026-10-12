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

- The public `GENERAL` lane accepts only published, localized, non-restricted questions with playable media. It rechecks moderation and publication before each server-authoritative round, clue and guess.
- Native Kids requires a parent-approved device and a guardian-pinned child profile. Every question, version, media item and entire pack must pass Kids safety eligibility. Child progress never participates in public ratings or leaderboards.
- `PlayRun`, `PlayRunQuestion` and `PlaySession` are the authoritative server records. Never trust client-submitted scores, quiz order or unlock progress.
- Children cannot access general audience features by passing a different lane; adult REST/MCP endpoints never accept native Kids bearer tokens.

## Feedback and discovery

- After a completed five-question run, rate questions on the result screen. One-off Discover questions can be rated as soon as they finish.
- Full packs have separate completion-gated pack feedback, reports and creator performance analytics, independently of question reviews.
- Discover highlights evidence-based popularity, quality and difficulty separately from explicit, ADMIN-selected `Editor's Pick` placements.

## Removed Weekly Five

The previously proposed recurring weekly challenge **was never launched**. The challenge proposal/schedule, special standings, associated routes and MCP operations are removed. Migration `20261013040000_remove_unused_weekly_challenges` drops the unused weekly tables, `PlayRun.weeklyId`, and `PlayRun.officialEligible`, with a fail-closed guard that refuses to drop those objects if any weekly records or runs exist.

Do not reintroduce weekly modes, weekly reservations, fixed-five editorial constraints, or user-visible weekly competition pages without a new product decision.

## Rollout

New production migrations are run by the main-branch deployment build plan, not automatically by development CI. Before main deployment, confirm migration order and apply migrations against a staging database snapshot; manually test complete `RANDOM_FIVE`, `INFINITE`, `PACK`, and child-device playback with real published revisions and approved media.
