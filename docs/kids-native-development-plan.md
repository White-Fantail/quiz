# QuizDip Kids — 독립 모바일 앱 전환 개발 계획

> 상태: 설계안 / 구현 미착수. 기준 브랜치: `dev` (2026-10-12 확인). 이 문서는 **모바일 기능 개발 4단계 + 기존 웹 Kids 제거 1단계**를 정의한다. 현재 웹 구현 완료 상태와 목표 구현 상태를 혼동하지 않는다.

## Phase 1 implementation record (2026-10-12)

- **Implemented in `dev` source:** `apps/kids` Expo SDK 57 React Native app, English/Korean four-tab shell, native iPad/Android responsive layout, read-only server-approved discovery preview, configurable dev API health check, common `@quizdip/i18n` Kids catalog and `@quizdip/api-client` contracts, npm scripts and CI jobs.
- **Not yet independently verified:** actual `npm install`, full TypeScript/build/Expo exports in a runner with dependencies, iPad/Android simulator, EAS TestFlight device builds and production OAuth. Source and CI additions are not proof of runtime success.
- **Deferred:** guardian native credentials and profile-pinned locale (Phase 2), playable quizzes and private rewards (Phase 3), time policies and parent analytics (Phase 4), full legacy web Kids UI removal (Phase 5). The old browser Kids routes remain active.
- **Release rule:** treat Phase 1 as a source-implementation milestone until automated validation and device smoke tests pass. Do not enable native child-session play prematurely.

## 0. 결정 및 범위

- 제품: 일반 웹 `QuizDip`과 iOS/iPadOS·Android 전용 앱 `QuizDip Kids`는 **각각 별도 인터페이스**를 가진다. 앱은 WebView 포장이 아니라 React Native + Expo/Expo Router로 구현한다.
- 저장소: **이미 npm workspaces 모노레포**이므로 재구축하지 않고 기존 `apps/web`, `packages/domain`을 보존하며 `apps/kids`를 추가한다.
- 서버: 기존 Next.js/Vercel 모듈러 모놀리스, PostgreSQL/Prisma, Better Auth, REST/MCP, R2, 안전성 심사 재사용. 모바일 때문에 별도의 API 서버를 만들지 않는다.
- 계정: 보호자의 기존 QuizDip 계정이 자녀 프로필·기기를 관리한다. 자녀는 별도 일반 QuizDip 계정을 만들지 않는다. 보호자 최초 설정/승인 후 자녀는 반복 로그인 없이 사용한다.
- 언어: 현재 플랫폼의 영어/한국어 locale을 공유한다. 선택 언어에 **공개되었고 승인된** 퀴즈만 서버에서 노출한다. 콘텐츠 언어 간 묵시적 폴백 금지.
- 보호: 제작자 지정 연령·AI 추천과 **플랫폼 안전성 승인**을 분리한다. 자녀 앱은 승인된 현재 언어 revision + 승인된 미디어만 접근한다.
- 운영: 변경은 `dev`에서 단계별 구현 및 검증. `main`은 사용자의 명시적 요청에만 fast-forward 전진.

## 1. 실제 구현 기준선 (웹 Kids 1·2단계)

### 완료된 것으로 소스에서 확인된 기능
- `apps/web/app/(platform)/kids/`: 별도 Kids UI shell, 홈/탐험/도전/내 보물 4개 탭, 공룡·동물·세계·과학 진입 카드, 영어/한국어 레이블, 태블릿 지향 레이아웃.
- 탐험: 타입·토픽·페이지네이션, `kids=true` 및 지정 locale 기반 `/api/v1/quizzes` 조회, 클라이언트 안전성 표시 재확인. **현재 목록은 미리보기일 뿐 카드에서 직접 플레이하지 않는다.**
- 도전·내 보물: **현재 placeholder**이며 게임/자녀별 보상이 완성된 상태가 아니다.
- `KidProfile` (nickname, EARLY/MIDDLE/OLDER, locale, sessionMinutes), `KidGuardianPin` (6자리 salted scrypt, 잠금), `KidDeviceSession` (해시 저장된 opaque token, 만료·철회).
- 보호자 로그인 후 PIN 설정/변경/재인증 후 재설정, 최대 8명 프로필, 최대 10개 활성 기기, 프로필 변경 시 활성 기기 철회, 기기 활성화·PIN으로 해제, 웹 잠금 redirect/REST 방어.
- `/api/kids/parent`, `/api/kids/device` 및 `apps/web/src/modules/kids/`에 보호자·세션 비즈니스 로직이 구현됨. `apps/web/test/kids-phase2.test.mjs` 존재.
- 현 `/api/v1/[...segments]`의 자녀 cookie 보호는 **quiz_list / topic_list GET만** 예외 허용한다. 모바일 게임 플레이에는 새로 설계된 **권한 범위가 제한된 자녀 인증**이 필수다.
- 기존 언어별 공개·번역·평가·게임 revision 및 server-side Kids eligibility는 보존한다. 자동 안전성 검토, 실제 R2/OAuth 운영 여부 등은 별도로 검증한다.

### 기존 4단계 계획으로부터 보존할 목표
1. 전용 어린이 인터페이스 및 언어별 안전 탐험.
2. 보호자 계정·PIN·자녀 프로필·기기 보호와 자녀가 어른 화면으로 나가지 못하는 경계.
3. 실제 멀티미디어 플레이·연령별 난이도/UX·개인 기록·보상.
4. 보호자 대시보드·이용 제한·운영/안전성 관리.

## 2. 목표 아키텍처

```text
quizdip/
  apps/
    web/                  Next.js: 일반 사용자/Studio/Admin/API/MCP
    kids/                 Expo + React Native + Expo Router
  packages/
    domain/               기존 순수 퀴즈 타입/규칙
    api-client/           모바일 대응 버전 관리된 REST 클라이언트/계약
    i18n/                 EN/KO 공통 메시지, locale 타입/순수 헬퍼
    game-core/            화면·서버·인증에 독립적인 표현/상태 헬퍼만
  prisma/                 공용 도메인·자녀 기록 스키마
  scripts/
```

- 처음에는 기존 **npm workspaces** 유지. Turbo/pnpm 도입은 문제 측정 후 별도 결정.
- UI 자체, 내비게이션, native media/audio, app auth flows는 공유하지 않는다. `next/headers`, Prisma Client, 비밀키, Node crypto, 서버 `operations`를 모바일 번들에 넣지 않는다.
- 서버의 정답 채점, 힌트 공개 권한, media signed access, published revision, 나이/언어/안전성 필터를 단일 규칙으로 유지한다.
- 원래 웹 Kids 브라우저 쿠키를 Expo 인증으로 억지 재사용하지 않는다. 모바일 전용 **device-bound scoped bearer credential**을 설계한다. 서버에는 토큰 해시·철회·만료만 저장하며 앱은 OS secure storage에 보관한다.
- 계정 OAuth는 기존 Better Auth ID를 유지하고 **system browser + PKCE/deep link** 흐름으로 연동한다. 기존 성인 세션과 child device token을 논리적·저장소 수준으로 분리한다.
- 내부 API 명세는 구조화된 버전과 오류 코드, cursor pagination, 응답 크기 제한, media 만료 재발급을 포함한다. 성인 Guardian operation은 REST/MCP parity를 검토하고, **자녀 기기용 capability 발급 등 MCP에 노출하면 위험한 행위는 명시적으로 예외를 문서화**한다.

## 3. 단계별 구현

### Phase 1 — 모노레포 모바일 기초 + Kids UI shell

**목적:** 기존 웹 기능을 손상하지 않고 iPad/Android에서 앱이 실행되고 공통 API/i18n을 호출할 수 있게 한다.

- `apps/kids` Expo/Expo Router, `@quizdip/kids` workspace, dev/prod 앱 식별자·딥링크·환경 분리, Expo EAS build/TestFlight 내보내기 설정.
- `packages/api-client`, `packages/i18n`을 browser/node 의존성 없는 순수 TS로 추출, 기존 `@quizdip/domain` 연결. 서버 전용 코드는 추출 대상에서 제외.
- RN 디자인 시스템: 큰 버튼, 그림 우선, 글을 읽지 못하는 연령을 위한 음성 안내 기반, iPad 가로/세로·Android tablet/phone, 접근성, reduce motion, 텍스트 확대.
- 홈·탐험·도전·내 보물 화면 골격을 웹에서 **의도와 문구만 재사용**해 새로 구현. 어른용 Studio·커뮤니티·일반 내비게이션 미포함.
- native 환경값/빌드가 기존 Vercel web build로 침투하지 않도록 workspace 별 CI 분리.
- 이 단계에서 웹 `/kids`는 **유지**하며 기능 회귀 검증.

**완료 기준:** iOS Simulator + 실물 iPad, Android emulator에서 앱 시작·EN/KO 전환·API health 확인; web+domain 테스트·typecheck·build와 native typecheck/build 모두 통과.

### Phase 2 — 보호자 온보딩·자녀 계정·기기 세션을 모바일로 이전

**목적:** 기존 웹 Kids Phase 2 기능을 모바일에서 안전하게 완성한다.

- 최초 진입: 보호자 Google/Apple OAuth → 6자리 PIN 설정/재인증 복구 → 자녀 프로필 생성/선택 → 사용 언어·연령대·기기 승인.
- KidProfile/GuardianPin/DeviceSession **기존 자료 보존**. 기존 guardian 계정 user ID 동일; 새로 가짜 자녀 일반 계정 생성 금지.
- Native 등록 API: 성인 actor 확인 + PIN 확인으로 기기 credential 발급; credential에는 child profile·scope·expiry가 서버에 고정됨. OS secure storage, revoke, rotation, reinstall/reset, 가구 내 형제 프로필 전환(PIN 필요)을 처리.
- 새 auth middleware: child credential은 kids catalog/play/progress 같은 명시된 operation만 허용. 성인 계정, Studio, Admin, MCP, profile mutation, 결제/외부 URL로의 권한 상승을 거부. **자녀 사용자 ID를 클라이언트 요청으로 신뢰하지 않는다.**
- Parent Gate: 보호자 PIN과 민감 행위에 대한 보호자 세션 재확인; 아동은 홈으로만 이동. 5회 PIN 오류 잠금, 분실 복구, 만료/철회/네트워크 장애 화면.
- 웹 기존 cookie auth는 전환 동안만 legacy 지원. 신규 모바일 API가 cookie 자동 승격이나 성인 세션 혼용을 허용하지 않도록 한다.
- 기존 `sessionMinutes`는 **등록 후 만료 시간에 사용**되고 있으므로 '일일 총 사용 시간'으로 해석하지 않는다. 기기 인증 유효기간과 플레이 시간 제한을 별도 모델로 분리·마이그레이션 계획 수립.

**완료 기준:** 실제 보호자 계정→기기 등록→자녀 재실행→PIN 보호 영역→원격 철회·복구 가능; forged credential·다른 집 프로필 조회·revoked device·잘못된 locale/age·세션 만료·기기 리셋에 모두 fail-closed.

### Phase 3 — 키즈 전용 탐색·실제 게임·내 보물

**목적:** 기존 웹 Phase 3 placeholder를 실제 플레이 경험으로 대체한다.

- 탐험 카드 탭→퀴즈 상세→서버가 승인한 퀴즈 revision 고정→힌트 단계별 공개(텍스트·이미지·소리·가능한 미디어)→터치 기반 추측→결과·다음 추천까지.
- 답안·아직 공개되지 않은 힌트·승인되지 않은 R2 media URL은 앱 번들/API에 공개하지 않는다. 채점·점수·클루 unlock은 서버의 기존 operation 재사용.
- 기존 random-five/weekly(KIDS lane)/선택형 한 문제를 자녀 프로필 문맥에서 동작시키며 5문제 종료 후 간단한 보상·반응 UX로 종료한다. 일반 공개 랭킹·공개 자녀 프로필·채팅/댓글/외부 링크 없음.
- 연령대 EARLY/MIDDLE/OLDER별 탐험 밀도·읽기 부담·힌트 표시·정답 선택 인터랙션 최적화. 난이도 추천은 이용자 경험이며 **안전성 승인 대신 사용하지 않음**.
- 콘텐츠 선정: 서버가 `publication=PUBLISHED`, Kids eligibility, locale published revision, age relevance, media independent approval을 검증. 번역본/미디어 변경 시 기존 승인을 승계하지 않는다.
- 자녀별 진행·노출 히스토리·발견한 동물/주제·보상(개인 기록) 저장. 성인의 일반 점수/랭킹과 혼합 금지. 자녀 삭제 시 기록 삭제 정책 명시.
- 가벼운 퀴즈 반응은 추가 가능하나 어린이에게 공개적인 평가·메시징 또는 경쟁을 강요하지 않음. 미디어 로딩 실패·승인된 문제 부족/고갈·언어별 부족을 친절하게 처리. 오프라인 플레이는 최초 출시 범위 밖(취소·심사 상태 stale 위험).
- 실제 승인된 이미지/소리 자료로 iPad에서 play E2E 진행. 단순 text demo를 실기기 완료로 판단하지 않음.

**완료 기준:** 해당 locale/age에 맞는 문제 탐험→play→서버 채점→5문제 종료→내 보물/학습 기록이 자녀별 분리 저장되고, 부적절/미승인/다른 언어 문제가 어떤 진입점에서도 보이지 않음.

### Phase 4 — 보호자 대시보드·이용 제한·출시 준비

**목적:** 기존 웹 Phase 4의 보호자 관리와 장기운영을 모바일 앱 내 Parent Gate 영역에서 제공한다.

- 보호자 페이지: 자녀별 탐험/퀴즈 수·관심 주제·연령 적합성·주간 활동 통계·기기 목록·언어·추천 수준, 기록 삭제 및 기기 해제.
- 실제 **일일 사용 제한**(기존 sessionMinutes와 별개), 회차 최대시간·휴식 알림·가족의 여러 기기 간 누적 시간·자정/시간대·clock tampering 처리. 서버가 authoritative policy/ledger를 검증; 보상 화면에도 동일 제한 적용.
- 자녀 개인정보 최소 수집; 위치·광고 ID·불필요한 분석/권한·프로필 공개/사용자간 소통 없음. 감사로그는 보호자/관리자 위주, 자녀 민감정보 기록 금지. 익명화/삭제/보관 기간·보호자 동의 검토.
- 운영: 신고/콘텐츠 제한, media 일괄 철회, 승인 취소의 빠른 전파, native crash/telemetry 품질 검증. App Store Kids Category/Google Play Families 정책 검토.
- 실기기 iPad 우선 + Android 검증; TestFlight/내부 테스트에서 보호자 온보딩·재설치·토큰 만료·권한·언어·미디어·접근성·프라이버시 점검.
- 서버 API 계약, 보호자 operation REST/MCP parity(예외 사유 포함), QA, migration/rollback, release runbook 문서화.

**완료 기준:** 보호자 주요 설정이 앱에서 모두 가능하고, 각종 제한이 우회되지 않으며 iPad/Android 베타 사용 가능. **web Kids 제거를 위한 기능/데이터 동등성 sign-off**를 남김.

### Phase 5 — 기존 웹 Kids 완전 제거 (앱 검증 이후)

**원칙: 모바일가 안정화되기 전 웹 Kids를 먼저 삭제하지 않는다.** 단, 신규 웹 Kids 기능 개발은 중단한다.

1. **사전 목록화:** `apps/web/app/(platform)/kids/**`, Kids CSS/components, `kidsHref`/탭, 홈/헤더 Kids 메뉴, localized navigation, route shell, child-cookie redirect, 사용하지 않는 Tests/i18n keys 검색; 외부 링크/SEO/로그인 callback 추적.
2. **데이터 이행:** 기존 웹 PIN·프로필·기기 관계를 새 모델에서 읽게 하고, 필요한 경우 명시적인 migration. 이전 cookie-only device token은 보안상 mobile token으로 자동 승격하지 않는다. 구웹 세션을 철회하고 새로운 native pairing으로 유도.
3. **Cutover 조건:** Phase 1~4 전체 통과, 실제 기기/베타 앱 배포 가능, 보호자·아동 UX 대체 확보, 서버에서 언어·안전·연령 필터 E2E 성공, 문제가 생겼을 때 재배포/rollback 방법 확인.
4. **삭제:** 모든 `/en/kids/**`, `/ko/kids/**`, `/kids/**` React/Next 화면 및 전용 layout/styles/child-mode 관련 일반 웹 메뉴 제거. 웹 cookie 전용 `/api/kids/device`와 브라우저 잠금/프록시 `KIDS_COOKIE` 처리 중 불필요해진 부분 제거. 기존 `/api/kids/parent`는 native guardian API가 대체되는지 확인 후 버전별 폐기. 앱 설치용 일반 웹 링크는 별도 마케팅 요소로 유지할 수 있지만 **웹 Kids 플레이/모드는 남기지 않는다.**
5. **유지:** Quiz `kidsEligible`/승인·모더레이션, GENERAL/KIDS game lane, KIDS weekly scheduling, locale/revision rules, KidProfile/GuardianPin/DeviceSession와 child-scoped API, R2 approved media, Admin/Studio 안전성 관리, REST/MCP 안전성 정책. 이들은 웹 'Kids 모드 UI'가 아니라 플랫폼 핵심 기능이다.
6. **검증:** `/kids` 경로가 더 이상 앱 내부 웹 화면을 제공하지 않는지, 일반 QuizDip Home/Play/Discover/Studio/SSO/REST/MCP 정상, Kids 모바일 모든 API 정상, 미사용 import 및 dead code 0, i18n 완전성·타입체크·테스트·Vercel build·native build 통과.
7. 기존 QR/북마크는 앱 스토어 안내 URL로 제한적 리디렉트하거나 제거한다. 앱 UI로 다시 들어가는 웹 fallback을 두지 않는다.

**최종 완료 정의:** 일반 웹에는 Kids 전용 UI, 켜기/끄기, 자녀 세션 잠금, 웹 Kids 플레이 화면이 없다. 자녀는 **오직 QuizDip Kids 앱**에서 플레이하고, 보호자는 앱 내 Parent Gate에서 관리한다. 서버 공통 안전성·콘텐츠·기록 기능은 계속 작동한다.

## 4. 공통 검증 규칙

- `main`은 요청 전까지 이동 금지. 각 Phase 완료 시 `npm run test`, `npm run typecheck`, `npm run build` + Expo 앱 typecheck/테스트/실제 디바이스 smoke; Phase 5 이후 stale web Kids test 의도대로 제거/대체.
- 일반 웹/모바일 양쪽의 신원·역할·API 권한을 분리한 회귀 테스트. REST/MCP parity 요구사항을 무시하지 않고 안전상 예외는 기록.
- 콘텐츠의 공개 여부와 Kids 승인 여부는 별도. 승인된 공개 퀴즈가 적다면 빈 상태를 정직하게 표시하고 일반 콘텐츠로 폴백하지 않는다.
- iOS/Android 빌드 가능과 앱스토어 심사 통과는 다른 항목. 계정·R2·백엔드 운영 환경이 준비되지 않으면 production-ready를 선언하지 않는다.
- 새 SDK/정책 적용 시 출처 확인: https://docs.expo.dev/guides/monorepos/ ; https://developer.apple.com/kids/ ; https://support.google.com/googleplay/android-developer/answer/9893335?hl=en

## 5. 구현 순서 요약

`P1 Native skeleton + 공유 계약 → P2 보호자/기기 인증 → P3 Kids 탐험·플레이·보상 → P4 보호자 관리·제한·베타 검증 → P5 웹 Kids 제거`

Phase 2에서 **웹 cookie 방식과 모바일 device credential의 차이**를 해결하지 않고 Phase 3로 넘어가지 않는다. Phase 4의 실질적 앱 대체 기능이 성공적으로 검증되기 전에 Phase 5로 넘어가지 않는다.
