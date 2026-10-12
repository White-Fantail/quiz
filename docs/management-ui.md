# QuizDip management design system

Adult **Account**, **Studio**, and **Admin** screens share the visual scale of Kids guardian setup while retaining their own content and permissions.

- Add `management-page` to the `container inner-page` root.
- Use `ManagementHeader` from `src/components/management-header.tsx` for eyebrow, title, description, and optional actions.
- Keep standard `placeholder-panel` sections, `studio-filters` / `media-filters` filter groups, and `studio-list-row` / `connected-provider` list rows; `app/management.css` supplies their unified spacing, controls, buttons and mobile behavior.
- Use semantic labels and existing `btn` and `feedback` classes. Avoid inline control sizing.
- CSS is imported after global styles, scoped to management roots. Discover and Play are intentionally excluded.
- All changes are presentational: keep API requests, roles, moderation, publishing, PIN/QR pairing, and media usage rights unchanged.

Routes covered: /account, /account/settings, /studio, /studio/media, /studio/weekly, /studio/quizzes/:id, /admin, /admin/quiz-review, /admin/weekly. The separate Kids guardian and connect pages keep matching Kids-specific components.
