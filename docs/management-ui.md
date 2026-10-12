# QuizDip management design system

Adult **Account**, **Studio**, and **Admin** screens share the visual scale of Kids guardian setup while retaining their own content and permissions.

- Add `management-page` to the `container inner-page` root.
- Use `ManagementHeader` from `src/components/management-header.tsx` for eyebrow, title, description, and optional actions.
- Keep standard `placeholder-panel` sections, `studio-filters` / `media-filters` filter groups, and `studio-list-row` / `connected-provider` list rows; `app/management.css` supplies their unified spacing, controls, buttons and mobile behavior.
- Use semantic labels and existing `btn` and `feedback` classes. Avoid inline control sizing.
- CSS is imported after global styles, scoped to management roots. Discover and Play are intentionally excluded.
- All changes are presentational: keep API requests, roles, moderation, publishing, PIN/QR pairing, and media usage rights unchanged.

Routes covered: /account, /account/settings, /studio, /studio/media, /studio/weekly, /studio/quizzes/:id, /admin, /admin/quiz-review, /admin/weekly. The separate Kids guardian and connect pages keep matching Kids-specific components.

## Return-to-list navigation (October 2026)

Paginated screens must not reset the visitor to the first page after opening a detail,
editing a quiz/pack, testing a quiz, or pressing browser Back. Use the URL as the
source of truth for list state: one-based `page` query parameters plus searches,
filters, sorting and any independent pagination controls (`kidsPage`, `reportsPage`,
`packPage`). `useListUrlState` keeps the managed query fields synchronized through
`history.replaceState` and restores them on `popstate` without adding history
entries for each keystroke. Other query fields are preserved.

Server-rendered detail routes use `listBackHref` with explicitly allowlisted
parameters to link back to the original listing; never trust a user-supplied
redirect URL. The public `/packs` catalog already uses URL pagination and now
carries its page to the pack detail. Search/filter changes reset pagination to
page one, whereas opening an item must not reset the list. The Studio media
library and admin pack's two independent queues use the same convention.

This is a web navigation-only change. REST operations, MCP tools, data model,
permissions, review decisions, and child-safety rules are unchanged.
