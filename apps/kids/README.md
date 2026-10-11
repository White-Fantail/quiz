# QuizDip Kids (Expo, Phase 1)

Dedicated iPad/iPhone/Android experience for QuizDip Kids. **Phase 1 is a preview shell, not a child-authorized production app.** The existing web Kids mode stays in service until the native app meets Phase 2–4 release gates.

## Start

Use Node.js 22.13+ and npm from the repository root:

```sh
npm install
cp apps/kids/.env.example apps/kids/.env
# Edit EXPO_PUBLIC_QUIZDIP_API_URL to the existing QuizDip dev/staging HTTPS origin
npm run kids:dev
```

Start an iOS Simulator, Android emulator, or Expo Go on a device from the Expo CLI. The Phase 1 screens support English and Korean, safe read-only Kids catalog preview, and a backend health check. Quiz play, saved treasures, parent linking, native pairing and protected sessions are planned for Phases 2 and 3.

## Validation

```sh
npm run kids:typecheck
npm run kids:bundle:ios
npm run kids:bundle:android
npm run test
npm run typecheck
npm run build
```

Run both native bundles from a machine with network-installed dependencies. For EAS internal distribution see `eas.json`; link your own Expo/EAS project before submitting. Real device and OAuth tests cannot be satisfied by TypeScript or JavaScript bundle export alone.

## Security scope

`EXPO_PUBLIC_*` values are public; put only the backend origin there. No API secrets, private media credentials, child access token or admin abilities belong in Expo configuration. Kids catalog uses server filtering, checks `kidsEligible === true` again defensively, and never includes the answer. An unconfigured API shows a clear setup state. App localization is a **temporary Phase 1 preview control**; guardian-pinned profile locale and scoped device credentials arrive in Phase 2. Do not infer Kids safety from the creator's intended age.

Plan: [native migration](../../docs/kids-native-development-plan.md).
