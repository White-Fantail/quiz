# QuizDip — publication, audience and safety policy

**Platform rule:** 문제 제작은 자유롭게. 공개는 즉시. 분류는 자동으로. 노출은 사용자에 맞게. 안전 관리는 지속적으로.

## Three independent concepts

| Decision | Authority | Creator controls? |
| --- | --- | --- |
| Intended audience (e.g. a dinosaur quiz made for 6-year-olds) | Creator | Yes |
| Recommended audience, topic and estimated difficulty | AI and play-quality analysis, with creator input | Can adjust suggestions |
| Platform safety classification and Kids exposure eligibility | Trusted moderation and safety services | **Never directly** |

Do not collapse these into a single creator-supplied minimum-age field. A hard question can still be entirely suitable for children. On mismatch between the creator's intent and the AI's predicted challenge, offer a change suggestion rather than denying publication.

## Publication is not the same as distribution

- **General mode:** ordinary quizzes can publish immediately after the necessary validation, anti-spam, abuse and legal/safety protections. No blanket moderator preapproval.
- **Kids mode:** show only content whose trusted classification is **affirmatively approved** for Kids, with approved media. Unknown or pending review stays hidden from Kids even if it is publicly published.
- **Restricted content:** remove or withhold from general as well when platform policy requires.
- A successful publish request does **not** imply a completed Kids review.
- Creators can edit, see review reasons, request reassessment and appeal. They cannot inject approved safety status via web form, REST or MCP.
- Changes to content, answer or media must not silently inherit old trusted approval. Keep revision-specific moderation decisions and auditability.

## Reports, ratings and appeals

Collect likes/dislikes separately from reports. Support wrong-answer reports, misleading clues, inappropriate material, copyright/privacy violations, spam and duplicates. Likes affect discovery. Reports enter a reasoned moderation process. Many dislikes alone should **not** trigger deletion: opinion differences, political controversy or quiz difficulty do not establish policy violation. Defend against retaliatory reporting, review manipulation and brigading, and enable fair appeal.

## Engineering checks

Enforce safety, publication state, media ownership, sensitive-answer visibility and administrator permissions **on the server**, shared by Studio, REST and Remote MCP. Audit moderation (who, what, when, reason and revision), require confirmation and rate limiting for significant changes, preserve versioned play statistics, use minimal child data, and never expose pending/restricted assets. Protect copyright and personal information when importing media.

See [architecture](architecture.md), [creator workflows](creator-workflows.md), [media storage](media-r2.md), and [API/MCP](api-mcp.md).
