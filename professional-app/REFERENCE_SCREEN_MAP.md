# FittinOS Pro: reference design → code map

Reference: "FittinOS Professional — Mobile App Complete Screen Guide" (39 numbered items).
The reference is a visual guide only. No names, amounts or records were copied from it.
Every figure in the app comes from the backend.

Route files: 39 screens under `src/app` (plus 4 `_layout.tsx` files).

- Unique screens: 38. The 39th, `/more`, only redirects to `/profile`.
- New in this pass: `profile-setup`, `appearance` and `leads/[id]`. `leads.tsx` moved to `leads/index.tsx`; the URL is unchanged.

Status legend:

- **Done**: implemented or restyled.
- **Shared**: rendered by a shared component.
- **Partial**: the reference shows something the backend doesn't support. That part is not faked.

| # | Reference item | Route / component | Status and notes |
|---|---|---|---|
| 01 | Splash Screen | Native splash (`app.config.ts`, `assets/splash-icon-dark.png`) + `components/BrandSplash.tsx` | **Done.** Dark brand splash in both system themes. Native splash needs a development build; Expo Go shows its own loader. |
| 02 | Welcome / Onboarding | `(auth)/welcome.tsx` | **Done.** Brand header, dark hero with 4 slides, feature list, Create account / Sign in. |
| 03 | Login | `(auth)/login.tsx` | **Partial.** Google sign-in is web-only in this backend, so the app says so instead of showing a working button. |
| 04 | Signup | `(auth)/signup.tsx` | **Done.** Brand header. Validation unchanged. |
| 05 | OTP Verification | `verify-email.tsx` + `components/ui/OtpInput.tsx` | **Done.** 6-digit boxes over one real input, so paste, autofill and screen readers work. Resend cooldown unchanged. |
| 06 | Forgot Password | `(auth)/forgot-password.tsx`, `(auth)/reset-password.tsx` | **Done.** |
| 07 | Session Restore | `components/BrandSplash.tsx` (root layout while `status === 'restoring'`), `offline.tsx` | **Done.** "Restoring your session…" appears only if restore takes over 0.6 s. Offline screen offers Try again and Sign out. |
| 08 | Profile Setup | `(app)/profile-setup.tsx` + `features/profile/setup-steps.ts` | **Done.** 7 steps from backend facts (6 web-dashboard checklist items plus open availability). Each step opens the existing editor. |
| 09 | Home Dashboard | `(app)/(tabs)/index.tsx` | **Done.** Greeting, payout hero, accepting toggle, 4 Bento tiles, upcoming sessions, open leads (open lead details), setup progress, quick actions. |
| 10 | Services | `(app)/(tabs)/services.tsx`, `services/[id].tsx`, `services/create.tsx` | **Done.** No service photos: services have no image field. |
| 11 | Earnings | `(app)/(tabs)/earnings.tsx` + `components/ui/BarChart.tsx`, `features/earnings/monthly.ts` | **Done.** Monthly chart drawn only when every earning record is loaded (API caps a page at 100). Reversed earnings excluded. |
| 12 | Availability | `(app)/(tabs)/availability.tsx` | **Done.** Two-week strip with real slot counts, add sheet, delete confirmation. |
| 13 | Profile | `(app)/(tabs)/profile.tsx` | **Done.** Hero, KYC/certification tiles, setup progress, about, details, certifications, menus (old "More"), sign out. |
| 14 | Bookings List | `(app)/bookings/index.tsx` | **Done.** Upcoming / Today / Past / All filters (the API's scopes). |
| 15 | Booking Details | `(app)/bookings/[id].tsx` | **Done** (themed). Actions follow `features/bookings/booking-actions.ts`. |
| 16 | Leads | `(app)/leads/index.tsx` | **Partial.** The API filters only "include responded", not New / Contacted / Converted tabs. All-time stats come from `/leads/stats`. |
| 17 | Lead Details | `(app)/leads/[id].tsx` | **Done (new).** Built from the loaded leads list (no get-one endpoint). Client contact details are not shown: they unlock only when the client unlocks the reply. |
| 18 | Messages | `(app)/messages/index.tsx` | **Done.** |
| 19 | Chat | `(app)/messages/[id].tsx` | **Done.** Composer stays above the keyboard. Report and block menu. |
| 20 | Voice / Video Call | `features/calls/CallOverlay.tsx` | **Shared.** Needs a development build (WebRTC); disabled with an explanation in Expo Go. |
| 21 | Notifications | `(app)/notifications.tsx` | **Done.** |
| 22 | Plans & Subscription | `(app)/plans.tsx` | **Done** (themed). Plans and cycles come from the backend. |
| 23 | Offers & Promotions | `(app)/promotions.tsx`, `(app)/featured-listings.tsx` | **Done** (themed). |
| 24 | Wallet & Coins | `(app)/wallet/index.tsx`, `wallet/buy.tsx` | **Done** (themed). |
| 25 | Payment / Checkout | `features/payments/useCashfreeCheckout.ts`, `CheckoutStatus.tsx` | **Shared.** Cashfree's own checkout UI (development build). Result sheet restyled. |
| 26 | Payout Account | `(app)/payout-account.tsx` | **Done** (themed). |
| 27 | Payout History | Earnings tab, "Payouts" segment | **Done.** Grouped by month. |
| 28 | KYC Verification | `(app)/verification.tsx` | **Done** (themed). |
| 29 | Appearance | `(app)/appearance.tsx` + `components/AppearancePicker.tsx` | **Partial.** System / Light / Dark with preview. Font size, language and accent colour are not supported by the app, so they're not offered. |
| 30 | Settings & Support | `(app)/settings.tsx`, `help/index.tsx`, `help/[id].tsx`, `legal.tsx` | **Done.** |
| 31 | Logout Confirmation | `ConfirmDialog` in `(tabs)/profile.tsx` | **Shared.** |
| 32 | Logout Complete | Welcome / login "Signed out" banner (auth-provider `signOutReason`) | **Done.** |
| 33 | Account Deletion | `DeleteAccountDialog` in `settings.tsx` | **Shared.** Password-confirmed. |
| 34 | Error States | `ErrorState` (`components/ui/states.tsx`), `offline.tsx` | **Done.** Icon and recovery per kind: offline, timeout, server, not found, rate limit. 403 offers Contact support. |
| 35 | Empty State | `EmptyState` | **Shared.** |
| 36 | Loading State | `LoadingCards` / `Skeleton` / `Spinner` | **Shared.** |
| 37 | Permission Denied | `ErrorState` (403 → "Contact support"), KYC-required banners | **Shared.** |
| 38 | Payment Failed | `CheckoutStatus` failed / cancelled / pending results | **Shared.** No automatic retry: retrying needs the original purchase context. |
| 39 | Validation Error | `TextField` error (icon + message), `OtpInput` error | **Shared.** |

Screens not in the reference were kept and themed:

- `reviews`
- `payments/index`
- `payments/[id]`
- `services/[id]`
- `services/create`
- `profile/edit`
- `legal`
- `help/[id]`
