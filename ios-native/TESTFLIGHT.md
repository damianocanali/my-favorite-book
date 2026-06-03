# TestFlight Submission Checklist

Use this checklist before every upload. Most rejections come from forgetting one of these.

## Pre-flight

- [ ] `Config.local.xcconfig` has **production** values (not sandbox/test) for `SUPABASE_ANON_KEY`, `GOOGLE_SIGN_IN_CLIENT_ID`, `REVENUECAT_API_KEY`
- [ ] `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in `project.yml` bumped (run `xcodegen` after to apply)
- [ ] Each Stripe & Lulu env var on Vercel `Production` is live, not test (these are server-side; nothing to do in this project)
- [ ] Signed in with the Apple Developer account that owns `com.myfavoritebook.app` in Xcode → Preferences → Accounts

## Build & archive

```bash
cd ios-native
xcodegen
open MyBookLab.xcodeproj
```

In Xcode:

1. Top device picker → choose **Any iOS Device (arm64)** (not a simulator)
2. **Product → Archive** (≈3 min)
3. When Organizer opens → **Distribute App** → **App Store Connect** → **Upload**
4. Sign & validate → Upload (≈2 min)
5. Wait for the "Build is processing" email (usually <30 min)

## App Store Connect

1. Open the new build in App Store Connect → **TestFlight**
2. Fill in:
   - **What to test** — short paragraph for the testers
   - **Export Compliance** — answer "uses standard encryption only" → Yes (we don't add custom crypto; this matches `ITSAppUsesNonExemptEncryption: false` in Info.plist)
   - **Add internal testers** (Apple Developer team members — no review required, available in minutes)
   - **External testers** (anyone with an email — requires Apple Beta App Review, ≈24h first time)

## Sanity checks before submitting for App Review

- [ ] Email + password sign-in works against **production** Supabase
- [ ] Apple Sign In works (native sheet, not browser)
- [ ] Google Sign In works (iOS OAuth client ID, not web)
- [ ] Sign out clears local state (no orphan books showing up signed-out)
- [ ] Create a book end-to-end → save → confetti fires → book appears on bookshelf
- [ ] Page editor → "Illustrate" returns a real image
- [ ] Story Buddy chat returns a real response
- [ ] Photo cartoonify: PhotosPicker → cartoon comes back
- [ ] Read aloud speaks the page text
- [ ] Paywall lists at least one plan, "Restore purchases" returns the right entitlement
- [ ] Print order end-to-end (with a $1 test product if you have one): Stripe sheet opens → pays → lands on Orders → status starts moving
- [ ] Parental gate (math problem) appears before camera and before any purchase

## App Store Review notes

- **Sign in with Apple is mandatory** (we offer Google) — already added as an entitlement, verify in Xcode → Signing & Capabilities that the capability is listed
- **Subscription disclosures** — PaywallView already includes auto-renew text + Terms + Privacy links. App Review's Guideline 3.1.2 checks for these
- **Physical goods exempt from IAP** — print orders use Stripe, which is allowed per Guideline 3.1.1 since the user receives a physical book. Mention this in App Review notes if asked
- **Kid-targeted (Guideline 1.3 / Kids Category)** — if the app is in Kids category, age rating must be set and Audience must be Age Range. Parental gates exist before any third-party link, purchase, or camera use

## Version bump for next release

```bash
# In project.yml:
#   MARKETING_VERSION: "2.0.1"   # patch release
#   CURRENT_PROJECT_VERSION: "2" # increment for every uploaded build
xcodegen   # regenerate so the new values land in Info.plist
```
