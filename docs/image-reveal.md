# Image Reveal clues

An image can be reused as multiple progressively revealing clues, without generating crops or duplicate blurred media files.

## Contract

Each step is one normal ordered clue, for scoring and wrong-guess limits.

```json
{
  "type": "image-reveal",
  "mediaId": "94f0792a-18e6-40c0-a480-0be6d46dbb37",
  "text": "Look more closely",
  "reveal": {"effect": "blur", "strength": 95, "focusX": 50, "focusY": 50}
}
```

- `effect`: `blur`, `zoom`, `spotlight`
- `strength`: integer 0–100, where 0 is fully revealed. Suggested stages: 95, 55, 0.
- `focusX` and `focusY`: percent 0–100, default 50. Used by zoom and spotlight.
- **Spotlight** reveals a small circular detail at high strengths and expands as strength decreases. At strength `87`, a typical iPad image frame reveals a circle of about **23 px radius**, not most of the subject. Web and native use the same curve and normalized-diagonal geometry; strength `0` removes the mask completely.
- The `mediaId` must be an owned, ready **image** asset. All normal publication and Kids moderation rules still apply.
- Repeating one `mediaId` is intentional. Previous reveal steps for the same image are visually superseded, but still count as clues.
- Existing `image` clues remain unchanged. Both formats can coexist in a quiz.

## Creator workflow

Studio → My quizzes → select quiz → **Image Reveal**. Pick one of that quiz's existing image clues as the source, choose effect, steps and focus. Saving creates an immutable revision, resets safety approval and requires published media to be approved, as with other edits. Test via **Test play** (does not record analytics).

The Studio wizard replaces *all* image/image-reveal clues with a contiguous sequence at the first image position. Text, audio, video and map clues remain. Review placement and captions if the original image clues were interleaved. The API/MCP can author individual steps without this shortcut.

## Limitations and security

Blur/zoom/spotlight run on the client for fast interaction. The full original image is transferred to web/app upon the first image reveal and can be recovered using developer tools; not appropriate as an anti-cheat mechanism for competitive/high-stakes games. For such games, serve per-stage image transforms through a protected server endpoint. No database migration is required: quiz revisions store clues as JSON.
