# FittinOS Professional — Web → Mobile Parity

**Contract source:** `origin/main` @ `493b54a` — the base of branch
`feature/professional-mobile-app` (worktree `C:\Users\shank\Downloads\MVP-mobile`).
The local `main` checkout was 26 commits behind `origin/main` (it lacks calls,
plan coupons/billing cycles, web push) and was not used as the contract.

**Status legend**

| Status | Meaning |
|---|---|
| **DEVICE** | Exercised on the Android emulator against the live origin/main backend (screenshots taken) |
| **API** | The screen's endpoints were called by the app's own API layer against the live backend (integration suite) and the screen is built + type-checked + bundled |
| **BUILT** | Implemented, type-checked and bundled; not exercised end-to-end |
| **BLOCKED** | Needs a backend change — documented, not faked |
| **N/A** | Web-only concern |

## 1. Feature parity table

| # | Web route / feature | Mobile screen (`src/app/…`) | Backend endpoints used | Status |
|---|---|---|---|---|
| 1 | `/login` | `(auth)/login` | `POST /auth/login`, `GET /auth/me` | **DEVICE** — wrong password shows backend 401 message; correct login opens dashboard |
| 2 | `/signup` (professional) + email code | `(auth)/signup`, `verify-email` | `POST /auth/register` (role fixed to PROFESSIONAL), `POST /auth/email/send-code`, `POST /auth/email/verify` | **BUILT** + unit (unverified → verify screen guard) |
| 3 | `/forgot-password` | `(auth)/forgot-password` | `POST /auth/forgot-password` | **BUILT** |
| 4 | `/reset-password?token=` | `(auth)/reset-password` (deep link `fittinospro://reset-password?token=`) | `POST /auth/reset-password` | **BUILT** (email links still point to the web page — see §3) |
| 5 | Google OAuth | — | — | **BLOCKED** (§3) |
| 6 | `/get-started`, feature tour | `(auth)/welcome` (4-slide onboarding) | — | **DEVICE** |
| 7 | Session restore / logout | `providers/auth-provider`, root guards, `offline` | `GET /auth/me`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all` | **DEVICE** (cold relaunch → dashboard, no re-login) + **API** (rotation, revocation) |
| 8 | `/professional/dashboard` | `(tabs)/index` | `/professionals/me`, `/earnings/summary`, `/leads/stats`, `/bookings`, `/professional/services`, `/notifications/unread-count`, `/conversations/my` | **DEVICE** |
| 9 | Accepting-work toggle (header) | `AcceptingWorkToggle` (dashboard + More) | `PATCH /professionals/me {acceptingWork}` | **DEVICE** (rendered) + **API** (toggle + restore) |
| 10 | `/professional/profile` | `profile/index`, `profile/edit` | `/auth/me`, `PATCH /auth/me`, `/professionals/me`, `PATCH /professionals/me`, `PATCH /professionals/me/location`, `POST …/location/diagnostics`, `POST /files/upload`, `/locations/search`, `/locations/geocode`, certifications | **API** |
| 11 | Certifications submit/list | `profile/index` (sheet) | `POST /professionals/certifications/submit`, `GET …/submissions`, `POST /files/upload` | **API** (list) / **BUILT** (submit) |
| 12 | `/professional/verification` + `/kyc-intro` | `verification` | `/professionals/kyc/submissions`, `POST …/kyc/aadhaar/start`, `POST …/kyc/aadhaar/fetch` | **DEVICE** (approved state) — DigiLocker start/fetch **BUILT** only (paid API Sathi call not triggered) |
| 13 | `/professional/services` | `services/index` | `/professional/services`, `PATCH`, `DELETE` | **DEVICE** |
| 14 | `/professional/services/create` | `services/create` | `/categories`, `POST /professional/services`, location via `PATCH /professionals/me` | **API** (categories) |
| 15 | `/professional/services/[id]` | `services/[id]` | `GET/PATCH /professional/services/:id` | **BUILT** |
| 16 | `/professional/availability` | `availability` | `/availability/me`, `POST /availability`, `DELETE /availability/:id` | **DEVICE** (empty state) + **API** (create + delete slot) |
| 17 | `/professional/leads` | `(tabs)/leads` + respond sheet | `/leads`, `/leads/stats`, `POST /leads/:id/respond` | **DEVICE** + unit (respond validation) |
| 18 | `/professional/bookings` | `(tabs)/bookings` | `/bookings?scope=` | **DEVICE** (empty state + CTA) |
| 19 | `/professional/bookings/[id]` | `bookings/[id]` | `/bookings/:id`, `POST …/start`, `…/complete`, `…/report-no-show`, `…/reschedule`, `/availability?professionalId=` | **BUILT** + unit (action rules) — no CONFIRMED booking existed in dev data |
| 20 | Booking-day trip tracking | `TripControlSheet` | `GET /bookings/:id/tracking`, `POST …/tracking/start`, `PATCH …/location`, `PATCH …/vehicle`, `POST …/stop` | **BUILT** |
| 21 | `/professional/messages` + `[id]` | `(tabs)/messages`, `messages/[id]` | `/conversations/my`, `/conversations/:id`, `POST …/accept`, `…/decline`, `…/messages` | **DEVICE** (list + thread) |
| 22 | Free voice/video calls + history | `features/calls/*`, `CallOverlay` | Socket.IO `/calls`, `GET /calls/ice-servers`, `GET /calls` | **DEVICE** — outgoing voice call placed (mic permission prompted at call time), cancelled, history row shown. Two-party connected media **not** tested (no second device) |
| 23 | `/professional/wallet` | `wallet/index` | `/wallet`, `/wallet/transactions`, `/wallet/coin-value` | **DEVICE** |
| 24 | `/professional/wallet/buy` | `wallet/buy` | `/coin-packages`, `POST /payments/orders`, `POST /payments/verify` | **DEVICE** — gateway disabled on the test backend → order refused, clear error, no checkout, no false success. A real Cashfree checkout was **not** exercised (§4) |
| 25 | Payment history + detail + receipt | `payments/index`, `payments/[id]` | `/payments/history`, `/payments/history/:id`, `…/receipt` (PDF → share sheet) | **API** (list) / **BUILT** (detail, receipt) |
| 26 | `/professional/plans` | `plans` | `/professional-plans`, `/professional-plans/me`, `/professional-plans/coupons/{available,validate}`, `POST /payments/orders {PROFESSIONAL_SUBSCRIPTION, billingCycle, couponCode}` | **DEVICE** (plans, cycles, offer box) + unit (plan rules) |
| 27 | `/professional/featured-listings` | `featured-listings` | `/featured-listings/plans`, `/featured-listings/me`, `POST /featured-listings/purchase/coins` | **API** (reads) / **BUILT** (purchase) |
| 28 | `/professional/promotions` | `promotions` | `/professional/promotions`, `/professional/promotions/analytics` | **API** |
| 29 | `/professional/earnings` | `earnings` | `/earnings/summary`, `/earnings`, `/earnings/payouts` | **DEVICE** |
| 30 | Payout account (backend only on origin/main) | `payout-account` | `GET/POST/PATCH/DELETE /professional/payout-account` | **DEVICE** (empty + readiness) / **BUILT** (save/remove) |
| 31 | `/professional/reviews` | `reviews` | `/bookings?status=COMPLETED` (session rating), `/professionals/me` | **BUILT** |
| 32 | `/professional/notifications` | `notifications` | `/notifications`, `PATCH …/:id/read`, `PATCH /notifications/read-all`, `DELETE /notifications/:id` | **DEVICE** + unit (web actionUrl → app route) |
| 33 | Notification preferences | `settings` | `GET/PATCH /notifications/preferences` | **DEVICE** |
| 34 | Web push | — | `/notifications/push/*` (VAPID) | **BLOCKED** (§3) |
| 35 | `/professional/settings` | `settings` | `PATCH /auth/me`, `POST /files/upload`, `POST /auth/change-password`, `DELETE /auth/me`, `POST /auth/logout-all` | **DEVICE** (rendered) / **BUILT** (actions) |
| 36 | `/professional/help` | `help/index`, `help/[id]` | `/support`, `/support/:id`, `POST /support`, `POST /support/:id/reply` | **API** (list) / **BUILT** |
| 37 | `/terms`, `/privacy`, `/refund-policy`, `/cookie-policy` | `legal` (opens canonical web pages in-app) | — | **BUILT** |
| 38 | `/professional/[id]` public profile | "Preview my public profile" (opens web) | — | **BUILT** |
| 39 | `/payments/return` | — (native SDK returns in-app, then the same `/payments/verify`) | — | **N/A** |
| 40 | Block / report a client (backend-only) | `messages/[id]` menu, blocked list in `settings` | `POST /conversations/:id/{block,report}`, `GET/DELETE /conversations/blocked` | **API** (list) / **BUILT** |

All 37 professional-relevant web routes on origin/main are accounted for above;
every one has a mobile screen except Google OAuth and web push (blocked) and
the payment-return fallback (not applicable).

## 2. Architecture

- `apps/professional-app` — Expo SDK 57, React Native 0.86 (New Architecture), Expo Router
  (typed routes, `src/app`), TypeScript strict, NativeWind 4.2.7 / Tailwind 3.4 with the web's brand tokens.
- **Not an npm workspace member** — root `package.json`/lock and web/backend untouched.
- `@fittin/shared-types` resolved from `packages/shared-types/src` (Metro alias + TS path).
- `src/api/client.ts` — single axios client; tokens in `expo-secure-store`; single-flight refresh that
  persists the **rotated** refresh token (the backend revokes all sessions on reuse); 401 on public auth
  routes never triggers a refresh. `src/api/endpoints.ts` — one typed function per real route;
  `src/api/queries.ts` — React Query keys/hooks.
- Payments: `react-native-cashfree-pg-sdk` `doWebPayment` with the backend `paymentSessionId`; the SDK
  result is never trusted — success only after `POST /payments/verify` (auto-retry while "not completed
  yet"), environment mismatch/DISABLED refused before opening checkout. No secrets in the app.
- Calls: the web's call engine (`apps/web/lib/calls/*`, byte-identical copies + their 95 `node --test`
  tests) driven by `react-native-webrtc` + `socket.io-client`; `react-native-incall-manager` for
  speaker/earpiece. No coin logic anywhere in calls.
- Permissions requested only at use: microphone/camera (call start/answer), location (trip start,
  "share my location"), camera/photos (avatar, certificate). Background location is removed from the manifest.

## 3. Blocked / backend gaps found

| Item | Finding | What the backend would need |
|---|---|---|
| Google sign-in | `redirect_uri` is fixed to `WEB_APP_URL/auth/callback/google` (`oauth.controller.ts#redirectUriFor`). | A per-client redirect (app link/scheme) or a native ID-token exchange endpoint. |
| Native push | Backend supports Web Push (VAPID) only. Consequence: incoming calls and notifications reach the app only while it is open. | Device-token registration + FCM/APNs sender. |
| Password-reset & email links | Emails link to the web (`/reset-password`). The app has a `fittinospro://reset-password?token=` screen ready. | Android App Links / app-aware email links (optional). |
| **Calls socket Origin (fixed in app)** | RN's Android WebSocket sends `Origin: <scheme>://<api host>`; `CallsGateway` rejects any Origin outside `CORS_ORIGINS` (`FORBIDDEN "This origin is not allowed."`) — reproduced from Node. The app now sends an empty Origin (the gateway's documented native-client path). Without this, calls fail in production too. | None required; optionally document native clients in the gateway. |
| Leads stats vs list | Root-caused in the release audit: `/leads/stats` counts requirements of **any status** with no plan-priority delay; `/leads` returns OPEN, unanswered, past-delay ones. The demo pro's 6 "new" are all CLOSED. The app now drives its badge/dashboard from `/leads` (see `RELEASE_READINESS_AUDIT.md`). | Count `newLeads` only for OPEN requirements (web dashboard is equally misleading). |
| Promotion analytics | origin/main does not return `professionalEarningAmount`; the screen shows it only if present. | — |

## 4. Not verified (honest gaps)

- **Real Cashfree checkout** — the local backend has the gateway disabled (no sandbox credentials were
  used; the dev `.env` holds PRODUCTION keys, deliberately not loaded). Verify with sandbox keys:
  `EXPO_PUBLIC_CASHFREE_ENVIRONMENT=SANDBOX` + backend `CASHFREE_ENVIRONMENT=SANDBOX`.
- **DigiLocker KYC start/fetch** — not triggered (paid API Sathi call); only the approved state was seen.
- **Two-party call media** (accept, connected audio/video, speaker, camera toggle) — needs a second
  signed-in client; the outgoing/cancel path and history were verified.
- Booking actions + trip tracking, certification submit, payout-account save, support ticket create,
  account deletion — built and type-checked, not exercised (no suitable dev data / destructive).
- `expo-doctor` 20/21: React Native Directory marks `react-native-webrtc`, `react-native-cashfree-pg-sdk`,
  `react-native-incall-manager` "untested on New Architecture". WebRTC capture + signaling worked on
  device under New Arch; Cashfree's native UI has not been opened.
- iOS — not built (Windows host).

## 5. Verification evidence (2026-10-09)

| Check | Result |
|---|---|
| `npx tsc --noEmit` (strict) | **0 errors** |
| Jest unit/UI (`npx jest --runInBand`) | **41/41 passed** — API client refresh/rotation/expiry (6), lib format/validation/errors/jwt (11), business rules (12: booking actions, availability planning, checkout, plans, notification routes, messaging, socket target), navigation/auth flows on the real route tree (9), error/empty/retry states (3) |
| Live backend integration (`INTEGRATION_API_URL=http://localhost:4200/api`) | **7/7 passed** against origin/main backend + dev DB: every professional read endpoint, acceptingWork toggle+restore, availability create+delete, disabled-gateway order refusal, refresh rotation, logout revocation |
| Call engine (`npm run test:calls`) | **95/95 passed** (the web's own suites on the app's copies) |
| `npx expo config --type public` | valid (`FittinOS Pro (Dev)`, `com.fittinos.professional.dev`, scheme `fittinospro`) |
| `npx expo-doctor` | 20/21 (New-Arch directory metadata warning above) |
| `npx expo export --platform android` | bundle OK (Hermes, 5.3 MB) |
| `expo prebuild` + `gradlew :app:assembleDebug` (x86_64) | **BUILD SUCCESSFUL** → `app-debug.apk` (105 MB) |
| Emulator `Medium_Phone` AVD | installed + ran: splash → welcome; login error + success; dashboard; cold-restart session restore; messages list + thread; socket connect; voice call start/cancel + history; more, plans, wallet, buy (refused safely), earnings, verification, services, availability, notifications, leads, bookings, payout account, settings |

Backend used for verification: origin/main code built in the worktree, run on **:4200** against the
existing dev DB `fittin` (already contains every origin/main migration — **no migration was run**),
with Cashfree, API Sathi and SMTP disabled in a gitignored `.env`.

## 6. Running it

```bash
cd apps/professional-app
cp .env.example .env            # includes APP_VARIANT=development (required for dev builds)
npm install
npx expo prebuild --platform android
npx expo run:android            # or: cd android && ./gradlew assembleDebug
npm start                       # Metro for the dev client
npm run typecheck && npm test && npm run test:calls
```

Release builds: leave `APP_VARIANT` unset and provide `ANDROID_APPLICATION_ID`, an `https://…/api`
`EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_CASHFREE_ENVIRONMENT`; the config refuses to load otherwise
(see `RELEASE_READINESS_AUDIT.md`). The final application id is an owner decision.
