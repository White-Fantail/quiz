# QuizDip web advertising

AdSense ads are manually placed. Never enable Auto Ads, which could place
advertising on quiz answers, clues, play controls or child-facing pages.
The native Kids app remains ad-free.

## Activation / emergency shutdown
- OFF or missing `ADSENSE_STATUS`: no ad DOM, whitespace, ad script, or network calls.
- REVIEW (default): same as OFF; set `ADSENSE_CLIENT_ID` if Google requires
  ownership verification. A valid ID emits `google-adsense-account` metadata,
  even though no ads are loaded.
- LIVE: requires `ADSENSE_STATUS=live`, `VERCEL_ENV=production`,
  valid `ADSENSE_CLIENT_ID=ca-pub-<16 digits>`,
  `ADSENSE_PRIVACY_READY=true` (manual attestation privacy notice and consent
  tooling are ready) and a valid numeric ID for each enabled ad placement.
  Otherwise the system **fails closed**.
- To stop ad requests: switch to OFF and redeploy production. Staging and preview
  never serve real ads even when other variables are present.
- Publisher and slot IDs are public but do not commit actual account IDs into git.

## Slots
- `ADSENSE_SLOT_DISCOVER_FEED`: ALL view after DiscoverySections; QUIZ/PACK
  results after the sixth card. Suppressed when Discover Kids filter is selected.
- `ADSENSE_SLOT_PACK_LIST`: standalone /packs, after eight cards.
- `ADSENSE_SLOT_PACK_DETAIL`: after pack reviews; suppressed on Kids-approved packs.
- `ADSENSE_SLOT_PLAY_RESULT`: only after FINISHED, never during play or web
  Kids lane or Kids-approved packs. Leave blank until result-page policy check.
- `ADSENSE_SLOT_SHARED_RESULT`: below the public shared result; leave blank
  until content and audience/policy eligibility has been checked.
- `ADSENSE_SLOT_HOME_BOTTOM`: reserved setting, not inserted yet.

Script is loaded once via provider, only after an eligible manual slot approaches
the viewport. A rendered ad slot reserves space on LIVE pages, and push-once
guards prevent repeated requests on strict-mode rerenders / route navigation.
Blocked ad scripts never break game flow. No backend schema changes.

## Validation
CI runs `npm run test`, `npm run typecheck` and `npm run build`, plus
Kids bundles. Test OFF/REVIEW page source and network, Kids exclusions, result
state transitions and provider's script count. After AdSense activation, use
real mobile and desktop browsers with consent choices and ad blockers to verify
loading and Core Web Vitals. Never click live ads during testing.
