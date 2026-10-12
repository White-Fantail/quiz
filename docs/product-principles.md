# QuizDip — product vision and principles

> **문제 제작은 자유롭게. 공개는 즉시. 분류는 자동으로. 노출은 사용자에 맞게. 안전 관리는 지속적으로.**

QuizDip is an open, AI-assisted quiz playground: **the fun is in following clues, reasoning, and discovering the answer**, not merely testing memorized knowledge. Anyone can become a player and a creator, and community feedback helps interesting questions grow. This is a single platform for adults and children, with audience-specific experiences and stricter protected Kids exposure.

## Core experiences

- **People / Who Am I?** — achievements, chronology, activities, historical figures, politicians, scientists and artists.
- **Animals / Guess the Animal** — partial photos, calls, habitats and behaviors; especially suitable for child-friendly multimodal play.
- **Places / Where on Earth?** — geography, climate, culture, photographs, map or globe answers.
- **Objects and Concepts** — science, nature, food, inventions, cultural phenomena.
- **Packs** — reusable collections of multiple questions.
- **Discover-first** — questions and packs are independently playable, shareable and reviewable. The dashboard features real popularity, challenge and clearly labeled admin-curated picks. Five random questions remain only as an optional newcomer quick start. See [play modes](play-modes.md).

Create game variants atop a common domain: Question, Answer plus accepted alternatives, ordered Clue, Media, Category, Difficulty, Audience, Safety and Quiz Pack. One question may use text, picture, sound, video, map or a mixture; each mode can define its own clue count, reveal rule, answer mechanism and point system. No mandatory universal clue count or scoring formula. See [clue design](clue-design.md).

## Make creation easy, not bureaucratic

Creators should supply as little information as possible. Accept natural language (“a dinosaur quiz for 6-year-olds”) and manual editing; AI may draft questions, clues and images and propose category, audience and difficulty. Keep detailed settings optional and editable. Avoid adding preapproval or lengthy forms to ordinary publication.

**Keep independent:** (1) creator's target intent; (2) AI-recommended audience and challenge; (3) trusted platform safety and Kids eligibility. The creator may correct intent and suggestions, **never** the platform safety grade. A challenging question may still be entirely appropriate for children. Ordinary general publishing should be immediate after mandatory security and anti-abuse checks; Kids visibility requires affirmative trusted safety clearance. See [content policy](content-policy.md).

Web Studio and ChatGPT/MCP are two authoring routes through the same services, database, owner checks, validation, moderation and audit. Publishing from an AI conversation needs a clear creator confirmation; the agent must not bulk publish autonomously. See [creator workflows](creator-workflows.md).

## Reward good puzzles and community

Players can like or dislike, report incorrect answers, unreliable clues, abusive content, spam, duplicates, copyright and privacy problems. Ratings improve discovery, but reports go through a separate review process. Dislikes alone do not trigger deletion, even for contentious political topics. Provide protections against brigading, malicious reports and appeals.

Creators can revise after publication. Preserve meaningful revision history and **version-aware** play statistics when a clue or answer changes. Useful signals: plays, accuracy, accuracy by clue step, completion, number of clues used, time to answer, replay, dropoff, votes and reports. Use them to flag giveaways, overly difficult or ambiguous questions and suggest improvements rather than impose invisible changes. Avoid collecting unnecessary data from children.

Provide creator pages, shared Packs, quality dashboards, discovery and eventually reputation/levels/badges; give newcomers real visibility rather than prioritizing high-volume creators forever. Quiz creation should itself be enjoyable.

## Product and implementation boundaries

The intended scope includes public Play and Discover, Studio, Kids mode, REST/MCP Connect, creator community and potentially Daily challenges. These are **capability areas**, not independent servers or necessarily finished features. The current repo offers creator-defined and random-order quiz packs, quick random-five and continuous play with strict API/MCP parity. The proposed recurring Weekly Five challenge was never launched and was removed. Do not equate a requirement or mock UI with deployed/verified capability. See [architecture](architecture.md), [roadmap](roadmap.md) and [development workflow](development-workflow.md).
