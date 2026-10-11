# QuizDip — brand guidelines

**Official product name:** QuizDip (퀴즈딥) · visual wordmark: `quizdip` · public domain: `quizdip.com` (owner reports availability; purchase, DNS and SSL are not verified by this repository).

**Main line:** A little quiz. A lot of fun.  
**Clue-led campaign line:** Follow the clues. Find the fun. / 단서를 따라, 재미를 발견해.  
**Platform message:** Create it. Play it. Share it. / 만들고, 풀고, 함께 즐겨.

## Identity

QuizDip is an open quiz playground for people who enjoy a quick challenge, following clues, figuring out answers, and creating quizzes for others. `Quiz` should be recognizable to English speakers; `dip` suggests casually dipping into an activity. **Do not claim that all English speakers automatically interpret the name as "dip into quizzes."**

The product includes a featured **Weekly Five** (five questions curated by a creator), random-five and unlimited practice, community-made quizzes, and an age-appropriate Kids experience. Weekly Five is a **game mode**, not a limit on the platform's quiz count.

- **Play:** Progressive clues, answers, scores and weekly challenges.
- **Discover:** Explore quizzes and creators.
- **Studio:** Create, edit, share and submit quizzes.
- **Kids:** A separately protected audience mode, not an independent service.
- **Connect:** REST / MCP tools under the QuizDip brand.

## Voice and visuals

Lead with play, curiosity and discovery—not tests, pressure or failure. Use short, encouraging, accurate copy; no humiliation for wrong guesses. Older and younger audiences can have different degrees of playfulness while sharing one content platform.

| Token | Hex | Use |
| --- | --- | --- |
| Primary purple | `#6255E8` | Main branding / actions |
| Mint | `#52D8B4` | Discovery / success |
| Yellow | `#FFD36E` | Clues / rewards |
| Coral | `#FF8D83` | Warm accents |
| Canvas | `#F8F7FC` | Soft backgrounds |
| Ink | `#252642` | Text |

The existing color system remains until a separate visual design review. The former `Pio` mascot was a proposal tied to the retired brand; it is **not** a QuizDip logo or approved mascot. Do not present a finished character asset without designing and approving it.

## Engineering and transition

The former **Clupio** name is retired from customer-facing copy, browser metadata, social sign-in labels and primary MCP display names. The GitHub repository is now `White-Fantail/quizdip`; URL routes, user IDs, persisted records, scores, authorization, safety policy and external integration endpoints are not changed by rebranding.

Use `quizdip_*` for MCP client integrations. Internal `@clupio/*` package names, old database defaults, token-signing namespaces and existing storage bucket identifiers must not be renamed without an explicit compatibility and migration plan.

QuizDip does not claim children-safe automation, AI classification, app-store registration, DNS activation or trademark registration unless actually verified. Content publication and Kids eligibility remain separate security decisions. The platform principles and child safety protections in `docs/product-principles.md` still govern every interface.
