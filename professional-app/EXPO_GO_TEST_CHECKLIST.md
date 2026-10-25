# FittinOS Pro — Expo Go Preview & UI Test Checklist

> **Navigation changed (2026-10-10 redesign).** Tabs are now **Home · Service · Earnings ·
> Availability · Profile**. Bookings, Leads and Messages are stack screens (same URLs:
> `/bookings`, `/leads`, `/messages`) reached from Home tiles, the header (messages and
> notifications icons) and the Profile hub. The old "More" tab is the lower half of
> Profile, and `/more` redirects there. The header moon/sun icon switches light ↔ dark,
> and Profile → Appearance offers System / Light / Dark. Rows below that mention
> "More tab" or the old tab names refer to these new places.

Date: 2026-10-10 · worktree `C:\Users\shank\Downloads\MVP-mobile` (branch
`feature/professional-mobile-app`, uncommitted).

## How to run it

| | Value |
|---|---|
| Expo Go version | Play Store **Expo Go for SDK 57** (tested: official 57.0.9 build) |
| PC address (Wi-Fi) | `192.168.1.8` — phone must be on the **same Wi-Fi** |
| Expo Go URL / QR | `exp://192.168.1.8:8081` · QR image: `C:\Users\shank\Downloads\FittinOS-Pro-ExpoGo-QR.png` |
| Backend | `http://192.168.1.8:4200/api` — worktree backend (origin/main code), dev DB, **Cashfree / API Sathi / SMTP disabled** |
| Test login | `pro@fittin.local` / `Demo@Password1` (seeded demo professional, dev DB only) |

Start commands (each in its own terminal; already running for you):

```bat
:: 1. backend (port 4200 comes from MVP-mobile\apps\backend\.env)
cd C:\Users\shank\Downloads\MVP-mobile\apps\backend
node dist/main.js

:: 2. Metro for Expo Go on the LAN (prints the QR code)
cd C:\Users\shank\Downloads\MVP-mobile\apps\professional-app
set REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.8
npx expo start --go --lan --port 8081
```

`apps/professional-app/.env` (gitignored, dev only) sets `APP_VARIANT=development`,
`EXPO_PUBLIC_API_URL=http://192.168.1.8:4200/api`, `EXPO_PUBLIC_CASHFREE_ENVIRONMENT=SANDBOX`.
Only these public values are bundled — no secrets.

**Why 4200 and not 4100:** `:4100` is the main tree's Docker `fittin-mvp-api` (an older
Sept 21 build without the calls / plan-coupon routes the app uses, and in use by
another session). `:4200` is this worktree's own backend config, running the
origin/main contract the app targets.

**If the phone can't connect:**
1. Same Wi-Fi as the PC; no VPN; the router has no AP/client isolation.
2. On the phone's browser, open `http://192.168.1.8:4200/api/health`. It should
   show `"status":"ok"`.
3. Windows Firewall: inbound Allow rules for Node exist on the Public profile
   (`…\nvm\v22.23.2\node.exe`, which `C:\nvm4w\nodejs` links to). If step 2 fails,
   allow Node on Public networks, or switch this Wi-Fi to Private.
4. Fallback: `npx expo start --go --tunnel`. Note: the API URL must still be reachable
   from the phone, so the tunnel only helps Metro.

**Expo Go caveats (important):**
- Expo Go shows "A new version … will only support SDK 58". Turn **off
  auto-update for Expo Go** in the Play Store, or after the update install Expo Go
  57.0.9 from the "compatible version" link Expo shows.
- Hide Expo Go's floating gear (Expo Go menu → "Tools button" off). It covers the
  ⋮ / bell buttons at the top-right.
- If a "Cannot connect to Expo CLI" warning appears, shake the phone → Reload.

## What cannot run in Expo Go (needs the development build)

| Feature | Native module | Expo Go behaviour (verified) |
|---|---|---|
| Voice/video calls, call controls, ringing | `react-native-webrtc`, `react-native-incall-manager` | Call buttons are disabled with "Voice and video calls need the FittinOS Pro app build (Expo Go doesn't include it)". Call history still shows. |
| Cashfree checkout (coins, plans) | `react-native-cashfree-pg-sdk` | "Online payments need the FittinOS Pro app build … No order was created." It refuses **before** calling the backend. Payment orders in the dev DB were 43 before and after testing. |
| Splash fade options | native splash config | Skipped in Expo Go (no warning) |

The development build keeps all of these (built and verified on 2026-10-09: calls,
the Cashfree path). Nothing was removed from the app.

## Fixes made for Expo Go

1. The three native-only packages are now loaded **lazily**, behind a capability
   check (`src/lib/native-capabilities.ts`). Before this, Expo Go crashed after
   sign-in, because `react-native-webrtc` throws on import.
2. Checkout checks capability before creating any order.
3. The splash `setOptions` call is skipped in Expo Go (it removes a startup warning).
4. The Plans offer-code input got an accessible label ("Offer code").

Tests: `src/__tests__/expo-go.test.tsx` covers capabilities and "no order created".
`tsc` 0 errors; Jest 35/35 on the focused suites after the changes, and 47/47 for
the full suite before the last two small edits.

## Legend

- **A** — automated (Jest unit/UI on the real route tree, or a live-backend integration test)
- **E** — exercised in **real Expo Go 57.0.9 on the Android emulator** over the LAN URL (this session)
- **☐** — still to do by hand on your phone

Tick ☐ only after you have done it yourself.

## Route-by-route checklist

| Route | Checks | A | E | Phone |
|---|---|---|---|---|
| Splash / launch | opens, restores session on cold start | ✓ restore/offline | ✓ cold restart → dashboard | ☐ |
| `(auth)/welcome` | renders, both buttons navigate | ✓ | ✓ | ☐ swipe the 4 onboarding slides |
| `(auth)/signup` | empty-submit validation, terms checkbox, back | — | ✓ validation + back | ☐ create a throwaway account (console email code — ask me for it) |
| `verify-email` | code validation, resend cooldown, "use a different account" | ✓ guard | — | ☐ |
| `(auth)/login` | empty validation, wrong password (backend message), success | ✓ | ✓ all three | ☐ |
| `(auth)/forgot-password` | invalid email, send link | — | ✓ invalid email | ☐ (no real email is sent; console mail) |
| `(auth)/reset-password` | deep link with token | — | — | ☐ optional |
| Home tab (dashboard) | stats, accepting toggle, open leads, quick actions, checklist | ✓ error/retry | ✓ renders, bell → notifications | ☐ toggle accepting (reversible), quick actions |
| Bookings tab | filters, list, detail, back | ✓ empty + error/retry | ✓ filters, detail, back | ☐ |
| `bookings/[id]` | payment block, actions, trip sheet, reschedule, no-show | ✓ action rules | ✓ cancelled booking detail | ☐ needs a CONFIRMED booking (see audit P1) |
| Leads tab | all-time stats, responded toggle, respond sheet | ✓ respond validation | ✓ | ☐ |
| Messages tab | filters, list | — | ✓ | ☐ |
| `messages/[id]` | thread, reply box, calls disabled in Expo Go, menu, report, block | — | ✓ banner, disabled calls, menu, report validation + cancel, block confirm + cancel | ☐ send a message (writes to dev DB) |
| Call screen | voice/video, mute, camera, speaker, end | ✓ engine 95 tests | **dev build only** | ☐ in the dev build |
| More tab | sections, rows navigate, sign out confirm | — | ✓ rows, sign out cancel | ☐ |
| `profile` | photo, details, share location, certifications | — | ✓ renders, cert sheet opens | ☐ photo picker + camera, location permission prompt |
| `profile/edit` | fields, validation, location search | ✓ limits | ✓ experience validation, location section | ☐ save a harmless edit |
| `verification` | KYC state, DigiLocker start | — | ✓ approved state | ☐ (DigiLocker disabled on this backend → expect an "unavailable" error) |
| `services` / `[id]` / `create` | list, pause/activate, edit validation, create validation | — | ✓ list, edit + validation, create validation | ☐ pause and re-activate |
| `availability` | counts, add sheet, validation, delete open slot | ✓ slot planning | ✓ sheet opens | ☐ invalid time → "Enter times as HH:MM." |
| `reviews` | rating summary, filters, empty state | — | ✓ | ☐ |
| `wallet` | balance, coin value, transactions | ✓ live API | ✓ | ☐ |
| `wallet/buy` | packages, select, pay | ✓ no-order test | ✓ refused, no order | ☐ |
| `payments` / `[id]` | filters, detail, receipt | ✓ live API | ✓ filters, detail | ☐ download receipt → share sheet (works in Expo Go) |
| `plans` | cycles, offer code, upgrade | ✓ plan rules | ✓ cycles, Upgrade refused, no order | ☐ apply an unknown code → backend error |
| `featured-listings` | active list, purchase sheet | ✓ live API | ✓ sheet opens/closes (no purchase) | ☐ confirm only if you accept spending dev coins |
| `promotions` | performance, offers | ✓ live API | ✓ | ☐ |
| `earnings` | summary, destination, earnings/payouts tabs | ✓ live API | ✓ | ☐ |
| `payout-account` | add form, validation, UPI switch, cancel | — | ✓ | ☐ save is a P0 test (dev DB only) |
| `notifications` | filters, mark read, delete, tap → route | ✓ route mapping | ✓ unread filter, tap → conversation | ☐ mark all read |
| `settings` | photo, change password, notification switches, blocked, sign out everywhere, delete account | — | ✓ password validation, delete + sign-out-all dialogs (cancelled) | ☐ notification switches |
| `help` / `help/[id]` | FAQ, new ticket validation | — | ✓ FAQ, ticket validation | ☐ |
| `legal` | 4 pages open in in-app browser, back | — | ✓ Terms opened, back | ☐ |
| Global | tab bar, Android back, keyboard over forms/dialogs, pull-to-refresh, offline error + retry | ✓ offline/error/retry | ✓ back, keyboard (dialog buttons stay visible) | ☐ turn Wi-Fi off → "Unable to connect" → Try again |

Emulator evidence: screenshots and per-step JSON results are in the session
scratchpad (`shots-go/`). About 85 scripted steps passed across the runs. Every
failure was investigated. Causes:

- Expo Go's floating tools button covering header buttons.
- A LogBox "Cannot connect to Expo CLI" toast covering the tab bar while the host
  was low on RAM.
- Expo Go replaying queued deep links.
- Content below the fold.

None of these was an app defect, except the missing offer-code label, which is
fixed. One automated sequence signed the demo account out (a clean
`/auth/logout`). Refresh-token rotation itself was confirmed across four automatic
refreshes in about 1.5 hours of use.

## Safety during this preview

- No real payments: Cashfree is disabled on the backend, and Expo Go can't open
  checkout anyway.
- No real KYC: API Sathi has no key.
- No real email: console transport.
- No transfers: payout provider calls are disabled.
- Writes go to the local dev DB only. Avoid: deleting the demo account, blocking
  Ananya Rao (it disables her conversation), and featured-listing purchases with
  dev coins.
