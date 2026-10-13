# QuizDip Kids — Native child app and adult guardian setup

Phase 5 source status (2026-10-12): Kids is a **separate Expo iPad/iPhone/Android app** (`apps/kids`). The Next.js child-facing web shell, games, tabs, CSS and web-only device-activation endpoint have been removed on `dev`. **This does not mean TestFlight/Play distribution, real-device QA or production DB migration have been completed.**

## First-time setup and pairing

1. On the adult's browser visit `/en/account/kids` or `/ko/account/kids` (ordinary QuizDip account area).
2. Sign in with Better Auth Google/Apple, create guardian PIN (or use recently authenticated PIN recovery), and create a child profile with age band and language.
3. Generate a random, five-minute, **one-use** pairing code after entering the guardian PIN.
4. On the child's QuizDip Kids **native app** enter the code and device name. The app stores child-only scoped credentials in OS secure storage. No adult cookie is sent to the child device.
5. Play approved quizzes and media in the native app, and adjust limits, profiles and private history in its PIN-gated guardian area. Parent can also revoke devices in adult `/account/kids`.

The adult REST adapter is `GET/POST /api/account/kids`. Native child API continues at `/api/kids/native/**`; parent grants/child token issuance are restricted and not exposed as general MCP capabilities. Publication, translations, safety flags, KIDS weekly lane, run grading, media and moderation continue in shared server modules.

## Legacy browser cutoff

- Old `/kids`, `/en/kids/**` and `/ko/kids/**` URLs redirect to adult `/account/kids` without any web Kids gameplay.
- A browser that still holds the HttpOnly `quizdip-kid-session` cookie is **not** automatically unlocked. The proxy sends it to `/account/kids/legacy-unlock` with a six-digit guardian PIN prompt and hides adult navigation. The browser-auth and general REST handlers continue denying this old capability.
- `POST /api/account/kids/legacy-unlock` verifies the cookie's hashed WEB session, the matching guardian PIN, revokes that old token and expires the cookie. Even after the old session was remotely revoked or expired, its hash is deliberately retained for guardian PIN recovery.
- This is a **temporary security transition**, not a web child interface. Automatically deleting the cookie would let a child inherit an existing Better Auth guardian session. If the stored WEB session row was deleted, use another adult device for reauthentication and manually clear old browser site data.

## Database and production gates

The original `KidProfile`, `KidGuardianPin`, `KidDeviceSession` and all native child-progress/usage/safety data remain. Apply `20261012230000_retire_web_kids_sessions` in staging after backups and previous migrations; it revokes WEB-only sessions without changing NATIVE tokens. The migration source **does not** confirm it has been executed.

Automated validation: `npm run test`, `npm run typecheck`, `npm run build`, `npm run kids:bundle:ios`, `npm run kids:bundle:android`. These are source/build gates. Real onboarding, old-cookie PIN release, EN/KO and R2 media, EAS device builds, app-store privacy and migration rollback must still pass separately before production cutover.

For execution and rollback review, see [Phase 5 runbook](kids-native-phase5-cutover.md).

## Native home greeting and parent entry
- The paired child's home screen greets the active profile (e.g. **Hello, Leo!**) and keeps the adventure banner and discovery cards.
- The former large white profile/language/parent panel is removed. A compact, accessible **Parents** control sits beside the greeting and navigates to the existing six-digit guardian PIN gate, never directly to private guardian settings.
- Child game language is still pinned by the guardian profile (web family settings or PIN-protected native guardian view); removing the informational panel does not enable child-controlled locale changes.


## Kids Home and Explore adventure discovery (2026-10-13)
The native child app uses the same adventure taxonomy and original SVG artwork on Home and Explore: Dinosaur World, Animal Safari, Space Explorer, Math Playground, Patterns & Shapes, Time Adventure, Around the World, Guess the Things, Science Lab, and a catch-all Mystery Box. Neither screen invents quizzes for a category. Home shows only categories with confirmed results in its loaded, finite child-approved catalogue window; it never displays an empty destination as an available game. Explore keeps every world discoverable and offers friendly empty/retry states and incremental Load More.

The Quiz packs tab is hidden from the main navigation (its route remains reachable for backward compatibility). Explore lists approved Kids quiz packs first, then individually approved quizzes, while Home promotes a currently eligible server editorial pick or an approved playable pack/quiz. All content comes exclusively from the child-scoped /api/kids/native views (packs, catalog, features), so the guardian-pinned language, age/safety checks, no adult ranking, play-time gate and PIN exit stay unchanged. The app never uses the public/general catalogue as a fallback.

**Category metadata limitation:** no authoritative category column currently exists on QuizPack; display groups are inferred conservatively from approved pack titles/descriptions and approved quiz titles/prompts, with quiz answerType as a fallback. Unclassified content goes to Mystery Box rather than being misrepresented as Dinosaurs. This heuristic is presentation only (not a safety gate) and scans the currently loaded page(s), not guaranteed exhaustive catalog counts. For a future full-content taxonomy, add trusted/editorial metadata across the shared REST/MCP contract with versioned pack-review invalidation, audit, and a migration; do not let a UI-only label affect Kids approval.

## Challenge and My treasures native redesign (2026-10-13)

Challenge now matches the adventure-first Kids visual language. The prominent purple mystery mission starts the already-supported `RANDOM_FIVE` native run; its game state and server grading are unchanged. It offers approved and playable Kids quiz packs as additional challenges using the existing guardian-language/age and time-gated child catalogue. A "Continue my game" tile only appears when a plausible saved native-game reference is present in OS SecureStore; the game screen still validates the actual reference and authorization server-side. An Explore link is always available. The screen does not invent a new daily challenge, completion streak, ranking, or reward.

My treasures displays the existing device-scoped private `KidTreasures` response as a chest illustration, genuine solved/played counts, earned badge cards, and illustrated personal discovery stickers. The badge display includes the three existing server milestones (first/5/10 **distinct solved quizzes**) and marks only badges present in the server response as collected; others remain locked. It intentionally does not present a numeric "next badge" progress bar because the response does not expose the distinct-question count. Personal discoveries are loaded fresh when the tab gains focus, not published to others or used for any public rankings. No new child data collection, reward write endpoint, REST or MCP operation, database field, or permission rule is required.

Challenge and treasure illustrations use locally authored React Native SVG components. Both screens use the same iPad/iPhone responsive card system and English/Korean localization as Home and Explore. Browser preview stays sample-only. Validate native rendering and accessibility with an actual device after CI completes.
