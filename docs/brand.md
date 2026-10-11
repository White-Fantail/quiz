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

The existing color system remains until a separate visual design review. **Pio (피오)** is a candidate curious companion from the brand concepts, not a finalized QuizDip mascot, official logo or usable illustration. If approved, use friendly unobtrusive reactions (more in Kids, fewer in Studio/Admin). Do not present a finished character asset without designing and approving it.

## Engineering and transition

**QuizDip** is the sole customer-facing brand in UI, metadata, social sign-in labels and MCP tool names. The GitHub repository is now `White-Fantail/quizdip`; URL routes, user IDs, persisted records, scores, authorization, safety policy and external integration endpoints are not changed by rebranding.

Use `quizdip_*` for MCP client integrations. Current source npm workspace scopes and imports use `@quizdip/*`. Immutable v1 HMAC signing labels remain internal compatibility identifiers and must not be changed without token migration tests. Deployed database and R2 bucket names require separate operational review; changing a source example does not migrate external resources.

QuizDip does not claim children-safe automation, AI classification, app-store registration, DNS activation or trademark registration unless actually verified. Content publication and Kids eligibility remain separate security decisions. The platform principles and child safety protections in `docs/product-principles.md` still govern every interface.

## Playful, curious and approachable — detailed tone

The design keywords are **Playful · Curious · Clever · Welcoming · Creative**, with approximate creative emphasis of 70% playful, 20% curiosity and 10% cleverness. This is a **qualitative design guideline, not a KPI**. Prefer play and discovery over exam, memorization and instruction. Encourage players who guess incorrectly, and never mock, patronize or mislead them. Adult copy can be restrained while Kids uses warmer and simpler wording. Precision in moderation, error and privacy messaging always wins over playful marketing.

| UI moment | Prefer | Avoid |
| --- | --- | --- |
| Start | 퀴즈 시작하기 / Let's play! | 평가 시작 |
| More evidence | 힌트 하나 더 볼까? / Show another clue | 실패했으니 힌트 사용 |
| Wrong answer | 아직 아니야! 다음 단서를 볼까? | 실력이 부족해요 |
| Correct | 정답이야! 알아냈네! | 정답 처리 완료 |
| Create | 내 퀴즈 만들기 / Create a quiz | 콘텐츠 엔터티 생성 |
| Publish | 퀴즈 공개하기 / Publish quiz | DB 등록 |
| Save error | 저장하지 못했어요. 다시 시도해 주세요. | 알 수 없는 오류 |

## Color accessibility, wordmark and mascot

Purple is the **primary** recognition cue. Mint, yellow and coral are secondary; avoid making them compete equally on one screen. Quizzes can feel lively, while Studio/Admin/policy screens need calm information hierarchy. Never encode success, safety, correctness or disabled state **only by color**; also use visible text or icons and test real contrast, especially small white text on mint/yellow. The round lowercase quizdip wordmark, question/spark motifs, modern readable Korean/English sans serif, dark mode and final icon/mascot system are **directions**, not approved final assets or font licenses.

## Names, game structure, localization and homepage

QuizDip **Play**, **Discover**, and **Studio** are the primary navigational spaces. **Packs** groups multiple questions, **Kids** is an eligibility-protected mode, **Connect** is the external ChatGPT/MCP capability, and **Daily** is an optional future feature, not promised shipping scope. These areas do not mean separate apps, APIs or databases. Use intuitive game labels such as Guess the Animal, Who Am I? and Where on Earth? without prefixing the brand on every game.

A proposed homepage offers a recognizable brand and Play/Discover/Create entry points, a curiosity-driven hero (e.g. “Curious? Let's play!”), topical cards and a brief creator proposition. Do not advertise unverified AI safety, a registered trademark or finished mascot art.

Support friendly natural **Korean and English** copy; the brand stays QuizDip / 퀴즈딥 across locales. Natural localized wording takes precedence over literal translation, except where legal, privacy or safety meaning requires precision. A UI “힌트” can correspond to the technical Clue model. Treat automatically translated quiz content and audio/video accessibility as separate quality tasks.

Fact-based political, historical and scientific clues must remain accurate and contextual. Brand delight must never bypass [content safety](content-policy.md), [clue-quality rules](clue-design.md) or [product principles](product-principles.md). Before launch, verify trademark/domain/social/app-store availability, logo and mascot assets, responsive/dark layouts, typography licensing, translations and actual OAuth/deployment configuration.
