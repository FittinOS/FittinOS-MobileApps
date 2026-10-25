# FittinOS Professional (mobile) — Release-Readiness Audit

Date: 2026-10-09 · Worktree `C:\Users\shank\Downloads\MVP-mobile` · branch
`feature/professional-mobile-app` (uncommitted) · contract `origin/main` @ `493b54a`
(re-fetched: unchanged).

**Verdict: NOT release-ready.** The app is functionally complete against the
backend contract, but the critical money, identity and calling flows below are
untested, and the release application id has not been decided.

## Summary

| Area | Result | Evidence |
|---|---|---|
| Routes: every mobile call exists on origin/main | **PASS** | Static audit: 93/93 distinct calls matched a controller route, 0 unmatched |
| Permissions | **PASS** | Professional-only routes are called only by the PRO app; reschedule/no-show (no role guard) are owner-scoped via `loadOwnedRaw`. Live 200s for every read as the demo pro |
| Request payloads vs DTOs (`whitelist` + `forbidNonWhitelisted`) | **PASS after fixes** | All fields exist in their DTOs. 3 client-side limit mismatches fixed (below) |
| Response shapes | **PASS** | Probed live earlier; 7/7 integration tests re-run today; mutation returns used by the app (`PATCH /auth/me`, `POST /support`, register/login) confirmed in services |
| Native WebSocket empty-Origin | **PASS** | 14/14 adversarial gateway probes (below); no backend change; web-origin protection unchanged |
| Secrets in app / bundle | **PASS** | 0 hits for 16 backend secret values + 4 secret patterns across 115 app files and a release JS bundle |
| Release configuration | **PASS after fix / BLOCKED on decision** | Unsafe dev defaults fixed; final Play application id needs the owner |
| `/leads/stats` vs `/leads` | **Root-caused** — backend semantics; mobile misuse **fixed** | Read-only DB evidence below |
| Cashfree sandbox payment | **BLOCKED** | Needs sandbox credentials on the backend |
| DigiLocker KYC | **BLOCKED** | Paid API Sathi call; needs an un-verified test professional |
| Two-device calls | **NOT TESTED** | Needs a second signed-in client device |
| Booking actions, certification, payout save, support ticket, account deletion | **NOT TESTED** | Built + type-checked; manual steps below |

## Defects fixed in this audit (mobile only)

1. **Unsafe release defaults** (`app.config.ts`, `.env.example`). A build without `APP_VARIANT`
   used to ship the `.dev` application id with cleartext HTTP, and a missing
   `EXPO_PUBLIC_API_URL` silently fell back to the emulator host. Now: release is
   the default; dev is opt-in (`APP_VARIANT=development` in the local `.env`); a
   release config **refuses to load** unless `ANDROID_APPLICATION_ID` (valid, not
   `.dev`), an `https://…/api` URL and an explicit Cashfree mode are set. Verified:
   no env → 3 errors; `.dev` id → refused; complete → `usesCleartextTraffic: false`.
2. **Misleading lead counts**: the tab badge, dashboard tile and "recent leads" used
   `/leads/stats` (which counts closed requirements as "new"), then led to an empty
   list. Now they use `/leads` (actionable). The stats tiles on the Leads screen are
   labelled "All-time … (includes closed requests)" and "Not responded".
3. **Client limits vs DTOs**: no-show reason max 1000 → **500** (`ReportNoShowDto`);
   plan offer code limited to **3–32** chars (`ValidatePlanCouponDto`);
   specializations/languages **≤ 60 chars each** (`UpdateProfessionalProfileDto`).
   The backend would otherwise have returned a 400.

Regression tests added: `src/__tests__/release-audit.test.tsx` (4 tests).

## WebSocket empty-Origin review

The app sends `Origin: ""` on the calls socket (React Native's Android WebSocket
otherwise sends `Origin: <scheme>://<api host>`, which the gateway rejects). The
gateway logic in `calls.gateway.ts#authenticateHandshake` runs the Origin check
only when the header is present. A **browser cannot omit or forge Origin**, so
the empty-Origin path is only reachable by non-browser clients, which must still
present a valid token. Protections that stay in force:

- **Handshake:** HS256 access JWT signed with the access secret and carrying `exp`
  (refresh tokens use a different secret); the socket closes at token expiry.
- **Every action:** the user is re-validated (ACTIVE, CLIENT/PROFESSIONAL,
  verified email); per-socket rate limiting.
- **Invite:** must be a participant; the conversation must be UNLOCKED; the callee
  must be active; neither side may have blocked the other. Non-participants get
  NOT_FOUND, so ids can't be probed.
- **Signaling:** participant-only; OFFER only from the caller, ANSWER only from
  the callee; only the owning socket may negotiate.

Live probes (origin/main on :4200, dev DB) — **14/14 PASS**:

| Probe | Result |
|---|---|
| empty Origin, no token / garbage / tampered signature / refresh token | UNAUTHORIZED ×4 |
| `Origin: https://evil.example` + valid token | FORBIDDEN "This origin is not allowed." |
| `Origin: http://10.0.2.2:4200` (RN default) + valid token | FORBIDDEN |
| `Origin: http://localhost:3000` (allowed web) + valid token | connected (web unaffected) |
| empty Origin + valid access token | connected |
| invite unknown conversation / signal + accept on a call you're not in | NOT_FOUND / CALL_NOT_FOUND / CALL_NOT_FOUND |
| malformed invite payload | VALIDATION_ERROR |
| unverified-email account | refused at handshake (EMAIL_NOT_VERIFIED) |
| **verified professional who is not a participant** → invite into the real conversation | NOT_FOUND |

Side effect: one throwaway account `audit-outsider-1791564519390@fittin.local`
exists in the **local dev DB only**. Delete it when convenient.

## Secrets & configuration

- **Bundled values:** only `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_CASHFREE_ENVIRONMENT`
  and `EXPO_PUBLIC_WEB_URL` are compiled in; `APP_VARIANT` /
  `ANDROID_APPLICATION_ID` are build-time only.
- **Never in the app:** Cashfree secrets, JWT secrets, TURN secrets, API Sathi
  and SMTP credentials, the Maps key (Places is proxied by the backend). The app
  receives only per-user, short-lived values (access/refresh tokens, payment
  session ids, TURN credentials).
- **Release application id (BLOCKED):** there is no Play/App Store listing,
  store link or `assetlinks.json` anywhere in the repo. A deleted 2026 planning doc
  used `com.fittin.professional(.staging)`; the app's placeholder was
  `com.fittinos.professional`. An Android id is permanent once published, so the
  owner must choose it and set `ANDROID_APPLICATION_ID` in the release environment.
- **Local dev now needs** `APP_VARIANT=development` in `apps/professional-app/.env`
  (copy `.env.example`), otherwise `expo start` / `run:android` stop with a clear
  error.

## `/leads/stats` vs `/leads`

| | `/leads` (`listLeads`) | `/leads/stats` (`getLeadStats`) |
|---|---|---|
| Requirement status | `OPEN` only | **any** (OPEN, CLOSED, …) |
| Already-answered | excluded (unless `includeResponded`) | counted under PENDING/… |
| Plan priority delay | `createdAt ≤ now − (topLevel − myLevel) × window` | **none** |

Read-only dev-DB evidence for `pro@fittin.local`: 6 requirements in his
categories, **all `CLOSED`**, 0 responses. No active subscription (level 0); top
active plan `priorityLevel` 3; `lead_priority_window_minutes` = 15, so new leads
reach him 45 minutes late. Stats therefore reports "6 new" while the list
correctly shows 0. **Backend recommendation (not changed here):** count `newLeads`
only for `OPEN` requirements (or rename it). The web dashboard has the same
misleading tile.

## Feature-parity notes (vs the origin/main professional web app)

- **Mobile-only, backend-supported:** payout-account screen (no web page on
  origin/main), block/report a client, sign out everywhere.
- **Web-only, minor:**
  - Payment history: search and date-range filters.
  - Reviews: text search, service filter, sort.
  - Bookings: confirmed/pending counters.
  - Plans: "download receipt" on the success screen (mobile has it under Payment history).
- **Blocked by backend:** Google sign-in (fixed web `redirect_uri`); native push
  (Web Push only), so calls and notifications reach the app only while it's open.

## Prioritized manual test checklist (untested critical flows)

Prerequisites:

- A **staging** backend at origin/main (or later), never production data.
- Build with
  `APP_VARIANT=development EXPO_PUBLIC_API_URL=<staging>/api EXPO_PUBLIC_CASHFREE_ENVIRONMENT=SANDBOX`.
- Two test professional accounts and one test client.
- Record every result in `WEB_TO_MOBILE_PARITY.md`.

### P0 — money and identity (must pass before release)

**1. Cashfree sandbox payment.**

- *Backend:* `CASHFREE_ENABLED=true`, `CASHFREE_ENVIRONMENT=SANDBOX`, sandbox
  client id/secret, `CASHFREE_NOTIFY_URL` reachable by Cashfree (tunnel), the
  webhook registered in the sandbox dashboard.
- *Coin purchase:* Wallet → Buy coins → Starter → Pay → complete with a Cashfree
  sandbox test UPI/card → app shows "Confirming…" then "Coins added". Check
  `GET /wallet` balance +100 (+bonus), Payment history row = Paid, receipt PDF
  downloads and opens.
- *Failure:* repeat with a sandbox failure instrument → "Payment not completed",
  no coin change.
- *Cancel:* close the checkout → "Payment cancelled" → "Check payment status" → no
  coin change.
- *Plan purchase:* Plans → Quarterly → apply a sandbox plan coupon → Upgrade → pay
  → "Plan activated"; `GET /professional-plans/me` shows the cycle, the quoted
  amount and bonus coins credited once.
- *Duplicate tap:* double-tap Pay → only one order (same `idempotencyKey`).
- *Mode mismatch:* app SANDBOX vs backend PRODUCTION → checkout must refuse to open.

**2. Account deletion.**

- Use a disposable professional with no upcoming bookings: Settings → Delete
  account → wrong password → error; correct password → signed out; logging in
  again fails.
- With an upcoming CONFIRMED booking → expect the `HAS_UPCOMING_BOOKINGS` message
  and the account intact.

**3. Payout account save.**

- KYC-approved professional: Payout account → Bank → mismatched confirmation →
  inline error → valid HDFC-style IFSC → Save → status "Verification pending",
  masked number only.
- Replace with UPI → pending again. Remove → readiness shows "on hold".
- Throttle: more than 10 saves/min → friendly "Too many attempts".
- An admin verifies it on the web → app shows Verified and "ready to receive payouts".

**4. DigiLocker KYC.**

- Fresh professional (KYC NOT_SUBMITTED), backend with API Sathi configured
  (paid call).
- Verification → Continue with DigiLocker → complete in the in-app browser →
  return → "I've finished on DigiLocker" → "Aadhaar verified. Awaiting admin
  approval", KYC = Under review.
- Also test: tapping "I've finished" before completing → "still pending", retry
  after the cooldown; closing mid-flow and reopening.
- Admin approves on the web → app shows Approved; the Free plan is activated.

### P1 — core workflows

**5. Two-device voice/video calls.**

- Pro on a phone or emulator, client on the web or a second device, conversation
  UNLOCKED.
- Voice and video: pro→client and client→pro; accept, reject, cancel, missed
  (let it ring out).
- While connected: mute, camera off/on, speaker toggle, hang up from each side.
- Kill the network mid-call → "Reconnecting…" → recovers or ends as connection lost.
- Background the app while ringing (expected limitation: no ring if the app is
  killed — no native push).
- Verify each call appears in history with the correct duration, and that no coin
  balance changes.

**6. Booking actions.**

- Client books a pro slot (paid via sandbox).
- Pro: Booking → Start session → Mark complete (with notes) → earning appears
  under Earnings as pending.
- Reschedule a CONFIRMED booking to another open slot (inside the full-refund
  window) and outside it (expect `RESCHEDULE_NOT_ALLOWED`).
- No-show: after the start time, report with a reason of < 10 chars (blocked)
  and a valid one → admin sees the dispute.
- Trip tracking inside the window: Start trip → choose vehicle → location
  permission → client web shows live location; update vehicle; stop sharing.
  Outside the window → "isn't available yet".

### P2 — supporting flows

**7. Certification submission.**

- Profile → Add a certification → pick a PDF and a JPG (and a >10 MB file →
  refused) → submit → appears "Under review".
- Admin approves → certification Approved; with KYC approved the profile goes live.

**8. Support ticket.**

- Help → New ticket (subject < 4 / message < 10 → blocked) → valid → opens the
  thread.
- Admin replies on the web → the reply appears after pull-to-refresh → reply from
  the app.
- A closed ticket shows the "closed" footer.

## Test evidence (this audit)

- `tsc --noEmit` — 0 errors.
- `jest --runInBand` — **45/45 passed** (unit, navigation/auth, error states,
  release-audit regressions); 7 live tests skip without `INTEGRATION_API_URL`.
- Live integration vs origin/main :4200 — **7/7 passed**.
- Call engine (`npm run test:calls`) — **95/95 passed**.
- Calls gateway probes — **14/14 passed**.
- Secret scan — **0 hits**.
- `expo config` guard — no env refused, `.dev` refused, complete release accepted
  (`usesCleartextTraffic: false`).
- Android export (dev variant) — OK, Hermes 5.3 MB.

No E2E suite was run. No migration was run. Nothing was committed or pushed.
The :4200 verification backend is stopped.
