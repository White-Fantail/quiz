# QuizDip Kids — standalone child-facing application shell

## Four delivery phases
1. **Phase 1 (this change):** a localized, independent /kids/* navigation and app shell; home,
   safe approved-content exploration previews, challenge and treasure landing states. No
   general header/footer, no links to adult Play/Discover/Studio/Account in Kids navigation.
2. **Phase 2:** authenticated parent-owned child profiles and device/session activation,
   server-authorized child-only capabilities, PIN/reauthenticated parent exit, recovery,
   time controls and deep-link/API restrictions. **Phase 1 is not a kiosk/security lock.**
3. **Phase 3:** dedicated age-adaptive Kids game/discovery engine, audio/picture clues,
   topic adventures, safe per-child history, private treasures and feedback.
4. **Phase 4:** guardian dashboard, fine-grained restrictions, session/device management,
   privacy and security hardening, accessibility/E2E launch review.

## Phase 1 guarantees
- Supports /en/kids and /ko/kids with the existing localized URL rewrite mechanism.
- Root app chrome is omitted on every /kids/* route; its independent Kids layout has a
  branded header, touch-friendly four-tab navigation and a Kids-only main area.
- All child-facing static UI strings are translated through the existing typed message
  registry; the global language selector remains available within Kids.
- Explore previews load the same API/DB, with `kids=true` and the exact current locale.
  Missing safety approval or published locale makes content unavailable. Extra client checks
  fail closed on inconsistent response metadata.
- No fake sample questions and no direct child link into general /play. Challenge/treasure
  screens clearly state that interactive play and personal progress arrive in Phase 3.

## Known security boundary
Phase 1 is **presentation separation, not an activated/restricted child session**.
Typing a general QuizDip URL manually remains possible until Phase 2 device/session controls
and server-side authorization are implemented. The existing general REST/MCP API remains
unchanged; no child identity is inferred from the Kids route, locale, or a browser cookie.
Do not market Phase 1 as a secure device lock or parent-approved Kids activation.
