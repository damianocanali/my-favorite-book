# MyBookLab iOS — Native (SwiftUI)

Fresh SwiftUI rewrite of the iOS app, replacing the Capacitor WebView in `../ios/`. Same bundle ID (`com.myfavoritebook.app`), same backend (Vercel + Supabase), same RevenueCat subscriptions. The web app at `mybooklab.app` is untouched and remains the source of truth for any cross-platform feature.

## Prerequisites

- Xcode 16+
- macOS 14+
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) — install once with `brew install xcodegen`
- An Apple Developer account with the bundle ID `com.myfavoritebook.app` already provisioned (it is — same as the Capacitor build)

## First-time setup

```bash
cd ios-native
xcodegen          # generates MyBookLab.xcodeproj from project.yml
open MyBookLab.xcodeproj
```

Xcode will resolve Swift Package Manager dependencies on first open (~2 min). Packages:

- [supabase/supabase-swift](https://github.com/supabase/supabase-swift) — auth + Postgres
- [RevenueCat/purchases-ios-spm](https://github.com/RevenueCat/purchases-ios-spm) — subscriptions
- [stripe/stripe-ios-spm](https://github.com/stripe/stripe-ios-spm) — print order payments
- [google/GoogleSignIn-iOS](https://github.com/google/GoogleSignIn-iOS) — Google OAuth (alternative to Supabase OAuth)

## Config (one-time)

The app reads runtime config from Info.plist keys, which XcodeGen passes through from environment variables at generation time. Set these in your shell profile (or a `.env` file you source) before running `xcodegen`:

```bash
export VERCEL_API_BASE='https://mybooklab.app'
export SUPABASE_URL='https://ydpblgmirurobwdhzbqj.supabase.co'
export SUPABASE_ANON_KEY='<publishable anon key from Supabase dashboard>'
export GOOGLE_SIGN_IN_CLIENT_ID='<iOS client ID from Google Cloud Console>'
export REVENUECAT_API_KEY='<iOS public API key from RevenueCat dashboard>'
```

Then regenerate the project so the new values flow into Info.plist:

```bash
xcodegen
```

> **Note**: The current `project.yml` references `$(GOOGLE_SIGN_IN_CLIENT_ID)` and other keys directly. If you'd rather hard-code them for now, edit the `info.properties` block in `project.yml` and replace the placeholders with literal values. Don't commit secrets — `SUPABASE_ANON_KEY` is publishable by design but `REVENUECAT_API_KEY` and `GOOGLE_SIGN_IN_CLIENT_ID` should live in environment, not git.

## Run

1. Select an iOS 17+ simulator (iPhone 15 Pro recommended)
2. Cmd+R

You should see the sign-in screen. Tap email + password sign-in with the same credentials you use on `mybooklab.app` — the bookshelf will populate from Supabase.

## Project layout

```
ios-native/
├── project.yml             # XcodeGen spec — edit this, regenerate
├── MyBookLab/
│   ├── MyBookLabApp.swift  # @main entry point
│   ├── Models/             # Codable structs mirroring the web JSON shapes
│   ├── Services/           # APIClient (Vercel endpoints) + AppConfig
│   ├── Stores/             # AuthStore, BookshelfStore (@Observable)
│   ├── Views/              # SwiftUI screens
│   └── Resources/          # Assets.xcassets, LaunchScreen, etc.
└── README.md
```

## What's implemented today (feature-complete for 2.0.0)

All phases of the original launch plan are built, and this is the build
shipping on the App Store:

- ✅ Project structure + SwiftPM dependencies wired
- ✅ Supabase client + session bootstrap on launch
- ✅ Email + password sign-in
- ✅ Sign in with Apple (native ASAuthorizationController flow) — needs the
  app's bundle id listed under the Supabase Apple provider's Client IDs,
  or every attempt fails with "Unacceptable audience in id_token"
- ✅ Sign in with Google (via Supabase OAuth + ASWebAuthenticationSession)
- ✅ Face ID app lock (BiometricCredentials + Keychain)
- ✅ Account screen with display-name edit + sign out
- ✅ Bookshelf grid loading from `user_books` table
- ✅ Book detail + flip-book viewing, read-aloud (AudioService)
- ✅ Book creation wizard + Story Buddy chat + page editor
- ✅ AI illustration / cover generation, avatar editor (photo cartoonify)
- ✅ Paywall + RevenueCat subscriptions, restore purchases
- ✅ Coin store + consumable coin-pack IAP (`coinPurchasesEnabled`)
- ✅ Print orders — Stripe payment sheet, status timeline
- ✅ Privacy manifest (`PrivacyInfo.xcprivacy`) for required-reason APIs
- ✅ Tab navigation (Books / Create / Orders / Account)

## 2.1 additions (security + fun)

Added after the 2.0.0 launch plan, in commit-sized chunks on top of the
list above:

- 🔐 Face ID login now stores **Supabase session tokens** in the
  Keychain instead of the password (legacy items migrate on first use)
- 🔐 **App Attest** on the paid AI endpoints (`Services/AppAttest.swift`
  + `api/attest/*` + `api/_appAttest.js`); requests degrade gracefully
  to an unattested reduced-cap tier on simulators/old builds/web
- ✨ Delight pack: page-turn SFX + haptics, end-of-book and
  save-celebrations, shake-anywhere for a story idea
- 🔥 Writing streaks + badges (`Stores/RewardsStore.swift`, server
  `api/streak.js` + migration 012) and unlockable alternate app icons
- 📱 Home-screen widget (`MyBookLabWidgets` target), print-order Live
  Activity (Dynamic Island), Siri shortcuts + Spotlight indexing

### One-time setup for the new features

1. `cd ios-native && xcodegen` — regenerates the project with the new
   `MyBookLabWidgets` extension target + entitlements.
2. Apple Developer portal: create App Group `group.com.myfavoritebook.app`
   (App Attest needs no portal setup; the entitlement is enough).
3. Supabase SQL editor: run `supabase-migrations/012_user_streaks.sql`
   and `013_app_attest.sql`.
4. Vercel env: `ATTEST_MODE=log` (flip to `enforce` after a TestFlight
   soak), optional `DAILY_IMAGE_LIMIT_UNATTESTED` (default 20).
5. Assets you may want to replace: SFX files
   `Resources/audio/{page-turn,celebrate,sparkle}.mp3` (code no-ops
   when missing) and the three placeholder alternate icons in
   `Assets.xcassets/AppIcon{Rocket,Rainbow,Night}.appiconset`.
6. App Attest can only be tested on a **physical device** — the
   simulator reports unsupported and requests simply go unattested.

## Remaining before submission

Code is ready; the open items are operational (see `LAUNCH-2.0.0.md` and
`TESTFLIGHT.md`):

- Real-device pass (Face ID, IAP, camera can't be exercised on simulator)
- Coin-pack consumables created in App Store Connect **and** RevenueCat,
  else the buy flow shows "Unavailable"
- Archive on a physical-device destination, upload to App Store Connect

## This is the shipped iOS app

**This native app is what ships on the App Store.** The Capacitor build in
`../ios/` is retired — it is kept only for reference and is no longer
released.

That matters when triaging production issues:

- Anything wrong in `ios-native/` is affecting **live App Store users**,
  not just local test builds.
- Fixes here only reach users through an App Store release. Server-side
  fixes (Supabase config, Vercel `api/` endpoints) reach them immediately.
- `src/` is the web app at mybooklab.app. It shares the same Supabase
  project and `api/` endpoints, but it is a separate surface — a fix in
  one does not fix the other.
