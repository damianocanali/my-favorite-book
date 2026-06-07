# iPad-Native Layouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the native SwiftUI app (`ios-native/MyBookLab`) feel designed-for-iPad across every feature in both orientations, without regressing the iPhone layout.

**Architecture:** Introduce a small shared set of adaptive primitives (`Views/Adaptive.swift`), then apply them consistently across views — content-column caps so nothing stretches edge-to-edge, size-class-driven grid/size tuning for iPad, and two genuine redesigns (an aspect-driven two-page reader spread and a landscape-aware hero). iPad-only branches gate on `horizontalSizeClass == .regular` or a `GeometryReader` aspect check; iPhone portrait (`compact` width) resolves to today's exact code paths.

**Tech Stack:** SwiftUI, iOS 17 deployment target, XcodeGen (`project.yml` → `MyBookLab.xcodeproj`), no test target.

---

## Verification model (read first)

This codebase has **no test target** and the work is visual SwiftUI layout, so the TDD test/implement loop does not apply. Each task's verification is instead:

1. **Build succeeds** for an iPad simulator.
2. **Visual check** on the booted **iPad Pro 13-inch (M5)** simulator in the relevant orientation(s).
3. **iPhone regression check** (where a task adds a size-class/aspect branch): confirm iPhone portrait is unchanged.

**Standard build command** (run from repo root):

```bash
cd ios-native && xcodebuild -project MyBookLab.xcodeproj -scheme MyBookLab \
  -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M5)' \
  -configuration Debug build 2>&1 | tail -25
```

Expected final line: `** BUILD SUCCEEDED **`

**Screenshot a running screen** (app launched on the booted sim, via Xcode Run or `simctl launch`):

```bash
xcrun simctl io booted screenshot /tmp/ipad-<screen>-<orientation>.png
```

> **First-build note:** SwiftPM may print `skipping cache due to an error: ... safe.bareRepository is 'explicit'` and re-fetch packages. These are non-fatal cache warnings; the build still resolves. If a build genuinely fails on package resolution, run `xcodebuild -resolvePackageDependencies -project MyBookLab.xcodeproj` once, then rebuild.

---

## Task 0: Baseline + branch

**Files:** none (setup only)

- [ ] **Step 1: Create a working branch**

```bash
cd /Users/damianocanali/Documents/my-favorite-book
git checkout -b ipad-native-layouts
```

- [ ] **Step 2: Confirm the project builds today (iPad)**

Run the standard build command above.
Expected: `** BUILD SUCCEEDED **`. If it fails, stop and resolve the environment before any code changes (see First-build note).

- [ ] **Step 3: Capture iPhone baseline screenshots for later diffing**

Boot an iPhone sim and screenshot the five tabs + reader in portrait. These are the reference for the iPhone regression gate.

```bash
xcrun simctl boot "iPhone 15" 2>/dev/null; open -a Simulator
# Run the app on iPhone 15 from Xcode, then for each tab:
xcrun simctl io booted screenshot /tmp/iphone-baseline-books.png
# repeat: gallery, create, orders, account, reader
```

Expected: reference PNGs saved under `/tmp/iphone-baseline-*.png`.

---

## Task 1: Shared adaptive primitives

**Files:**
- Create: `ios-native/MyBookLab/Views/Adaptive.swift`
- Modify: `ios-native/MyBookLab/Views/SignInView.swift:252-266` (remove the local `contentColumn` extension — it moves to the shared file)

- [ ] **Step 1: Create the shared primitives file**

Create `ios-native/MyBookLab/Views/Adaptive.swift`:

```swift
import SwiftUI

/// Standard maximum content widths for constraining layouts on large
/// screens (iPad). On iPhone these caps exceed the screen width, so they
/// are visual no-ops — the iPhone layout is unchanged by construction.
enum ContentWidth {
    /// Forms, account, checkout, order detail, sign-in, wizard steps.
    static let form: CGFloat = 640
    /// Lists and single-column reading content.
    static let reading: CGFloat = 720
    /// Wider grids/galleries, centered on very large screens.
    static let wide: CGFloat = 1000
}

extension View {
    /// Caps interactive content (forms, primary buttons, lists) to a
    /// comfortable reading width and centers it horizontally. On iPhone the
    /// cap is wider than the screen, so it behaves like full width; on iPad
    /// it stops content stretching edge-to-edge and gives natural side
    /// padding. Kids are mostly on iPad, so this keeps screens looking
    /// deliberate rather than blown-up.
    func contentColumn(maxWidth: CGFloat = ContentWidth.form) -> some View {
        self
            .frame(maxWidth: maxWidth)
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.horizontal, 20)
    }
}
```

- [ ] **Step 2: Remove the duplicate helper from SignInView**

In `ios-native/MyBookLab/Views/SignInView.swift`, delete the entire trailing extension block (lines ~252-266):

```swift
extension View {
    /// Caps interactive content (forms, primary buttons) to a comfortable
    /// reading width and centers it horizontally. On iPhone the cap is
    /// wider than the screen, so it behaves like full width; on iPad it
    /// stops buttons and forms from stretching edge-to-edge and gives the
    /// layout natural side padding. Kids are mostly on iPad, so this keeps
    /// those screens looking deliberate rather than blown-up.
    func contentColumn(maxWidth: CGFloat = 440) -> some View {
        self
            .frame(maxWidth: maxWidth)
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.horizontal, 20)
    }
}
```

Leave SignInView's call site `.contentColumn(maxWidth: 360)` (line ~169) untouched — it now resolves to the shared helper.

- [ ] **Step 3: Register the new file with XcodeGen**

`project.yml` includes the whole `MyBookLab` folder as sources, so regenerate the project so the new file is compiled:

```bash
cd ios-native && xcodegen
```

Expected: `Created project at .../MyBookLab.xcodeproj`.

- [ ] **Step 4: Build**

Run the standard build command.
Expected: `** BUILD SUCCEEDED **` (proves the shared helper resolves and SignInView still compiles with no duplicate definition).

- [ ] **Step 5: Commit**

```bash
git add ios-native/MyBookLab/Views/Adaptive.swift ios-native/MyBookLab/Views/SignInView.swift ios-native/MyBookLab.xcodeproj
git commit -m "feat(ios-native): shared adaptive primitives (contentColumn + width tokens)"
```

---

## Task 2: Reader two-page spread — `BookDetailView`

**Files:**
- Modify: `ios-native/MyBookLab/Views/BookDetailView.swift` (`pageCard` ~208-264; image frame at line 243)

This is the highest-priority feature. Goal: in landscape, render illustration on the left half and text on the right half of one cream card; in portrait, keep the stacked card but let the image scale instead of being fixed at `height: 240`.

- [ ] **Step 1: Replace `pageCard` with an orientation-aware layout**

In `ios-native/MyBookLab/Views/BookDetailView.swift`, replace the entire `pageCard(page:)` function (currently lines ~208-264) with:

```swift
    private func pageCard(page: BookPage) -> some View {
        let illustration = page.illustrationData ?? ""
        let isRealImage = illustration.hasPrefix("http") || illustration.hasPrefix("data:")

        return bookCard {
            GeometryReader { geo in
                let isLandscape = geo.size.width > geo.size.height
                let illo = pageIllustration(illustration: illustration, isRealImage: isRealImage)
                let text = pageText(page: page)

                if isLandscape {
                    // Two-page spread: illustration left, story right.
                    HStack(spacing: 20) {
                        illo
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        VStack(alignment: .leading, spacing: 12) {
                            text
                            Spacer()
                            pageNumberBadge(page: page)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding()
                } else {
                    // Stacked: illustration scales to available width.
                    VStack(alignment: .leading, spacing: 12) {
                        illo
                            .frame(maxWidth: .infinity)
                            .frame(height: geo.size.height * 0.55)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        text
                        Spacer()
                        pageNumberBadge(page: page)
                    }
                    .padding()
                }
            }
        }
    }

    @ViewBuilder
    private func pageIllustration(illustration: String, isRealImage: Bool) -> some View {
        if isRealImage, let url = URL(string: illustration) {
            AsyncImage(url: url) { phase in
                if let img = phase.image {
                    img.resizable().scaledToFill()
                } else if phase.error != nil {
                    Image(systemName: "photo").foregroundStyle(.gray)
                } else {
                    ProgressView()
                }
            }
        } else {
            ZStack {
                LinearGradient(
                    colors: [
                        (Color(hex: book.colors?.cover) ?? .purple).opacity(0.18),
                        (Color(hex: book.colors?.accent) ?? .pink).opacity(0.18)
                    ],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                )
                Text(book.characters.first?.emoji ?? book.setting?.emoji ?? "✨")
                    .font(.system(size: 56))
            }
        }
    }

    private func pageText(page: BookPage) -> some View {
        Text(page.text)
            .font(.system(.body, design: .serif))
            .foregroundStyle(.black)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func pageNumberBadge(page: BookPage) -> some View {
        HStack {
            Spacer()
            Text("\(page.pageNumber)")
                .font(.caption.bold())
                .frame(width: 28, height: 28)
                .background(Color(hex: book.colors?.cover) ?? .purple, in: Circle())
                .foregroundStyle(.white)
        }
    }
```

- [ ] **Step 2: Build**

Run the standard build command.
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 3: Visual verify on iPad — both orientations**

Run on iPad Pro 13" sim. Open a book with pages. In **landscape** confirm the illustration fills the left half and text sits on the right (spread). Rotate to **portrait** and confirm the stacked card with a large illustration (no big empty cream gap). Confirm page swiping and read-aloud still work.

```bash
xcrun simctl io booted screenshot /tmp/ipad-reader-landscape.png
xcrun simctl io booted screenshot /tmp/ipad-reader-portrait.png
```

- [ ] **Step 4: iPhone regression check**

Run on iPhone 15. Portrait: confirm the page card looks like the baseline (stacked, image ~55% height — visually equivalent to the prior fixed 240). Rotate to landscape and confirm the spread is readable, not cramped. If the spread feels too tight on the phone, gate it by also requiring `geo.size.width > 700` in the `isLandscape` check.

- [ ] **Step 5: Commit**

```bash
git add ios-native/MyBookLab/Views/BookDetailView.swift
git commit -m "feat(ios-native): two-page reader spread in landscape, scaling image in portrait"
```

---

## Task 3: Landscape-aware hero — `HeroLanding`

**Files:**
- Modify: `ios-native/MyBookLab/Views/HeroLanding.swift` (fixed sizes at lines ~34, 41, 54, 90; layout ~95)

- [ ] **Step 1: Read the current file**

Read `ios-native/MyBookLab/Views/HeroLanding.swift` in full to identify the logo halo (`frame(width: 380, height: 380)`), logo image (`frame(width: 160, height: 160)`), title font (`size: 56`), CTA (`frame(maxWidth: 360)`), and the outer `VStack`/`frame(maxWidth: .infinity, maxHeight: .infinity)`.

- [ ] **Step 2: Wrap the hero content in an aspect-aware layout**

Restructure the body so the logo+text+CTA group is produced once and arranged by orientation. Replace the outer content `VStack { ... }.frame(maxWidth: .infinity, maxHeight: .infinity)` with:

```swift
        GeometryReader { geo in
            let isLandscape = geo.size.width > geo.size.height
            let isRegular = geo.size.width >= 700   // iPad-ish width

            Group {
                if isLandscape {
                    HStack(spacing: 48) {
                        logoBlock(isRegular: isRegular)
                        textAndCTA(isRegular: isRegular)
                    }
                } else {
                    VStack(spacing: 28) {
                        logoBlock(isRegular: isRegular)
                        textAndCTA(isRegular: isRegular)
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(40)
        }
```

- [ ] **Step 3: Extract `logoBlock` and `textAndCTA` with scaling sizes**

Add these helpers to `HeroLanding`, moving the existing halo/logo/title/CTA views into them and replacing the fixed sizes with `isRegular`-scaled values:

```swift
    @ViewBuilder
    private func logoBlock(isRegular: Bool) -> some View {
        let halo: CGFloat = isRegular ? 460 : 320
        let logo: CGFloat = isRegular ? 200 : 150
        ZStack {
            // (keep the existing halo gradient/blur view, but use `halo` for its frame)
            Circle()
                .fill(/* existing halo fill */ Color.white.opacity(0.08))
                .frame(width: halo, height: halo)
                .blur(radius: 40)
            Image("Logo")            // keep the existing logo image source
                .resizable()
                .scaledToFit()
                .frame(width: logo, height: logo)
        }
    }

    @ViewBuilder
    private func textAndCTA(isRegular: Bool) -> some View {
        let titleSize: CGFloat = isRegular ? 68 : 48
        VStack(spacing: 20) {
            Text("My Book Lab")     // keep the existing gradient wordmark modifiers
                .font(.system(size: titleSize, weight: .heavy, design: .rounded))
            // keep the existing CTA button; relax its cap on iPad:
            // .frame(maxWidth: isRegular ? 460 : 360)
        }
    }
```

> Implementer note: preserve the **exact** existing halo gradient, wordmark gradient/foreground styling, and CTA button (`SparkleButton` or equivalent) — only the numeric sizes and the wrapping layout change. The snippet shows the shape; graft the real subviews in.

- [ ] **Step 4: Build**

Run the standard build command.
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 5: Visual verify on iPad — both orientations**

Run on iPad Pro 13". Confirm **landscape** shows logo-left / wordmark+CTA-right filling the width; **portrait** shows a centered stack with a larger logo/title than before.

```bash
xcrun simctl io booted screenshot /tmp/ipad-hero-landscape.png
xcrun simctl io booted screenshot /tmp/ipad-hero-portrait.png
```

- [ ] **Step 6: iPhone regression check**

iPhone 15 portrait: confirm the hero is a centered stack with sizes close to baseline (320 halo / 150 logo / 48 title ≈ today's 380/160/56 — acceptable; if you want pixel-parity on iPhone, set the `else` branch sizes to the original 380/160/56). Confirm CTA still ~360 wide.

- [ ] **Step 7: Commit**

```bash
git add ios-native/MyBookLab/Views/HeroLanding.swift
git commit -m "feat(ios-native): landscape-aware hero with scaling logo/title on iPad"
```

---

## Task 4: Adaptive shelves — `BookshelfView`

**Files:**
- Modify: `ios-native/MyBookLab/Views/BookshelfView.swift` (`booksPerRow` ~224, `spineWidth` ~312, skeleton ~402, nested ScrollView ~233, example card ~165-179)

- [ ] **Step 1: Add a size-class environment + computed shelf metrics**

Read the file. Add to the relevant struct(s) that own `booksPerRow`/`spineWidth`:

```swift
    @Environment(\.horizontalSizeClass) private var hSize
```

Replace the stored `private let booksPerRow = 5` with a computed value:

```swift
    private var booksPerRow: Int { hSize == .regular ? 9 : 5 }
```

Replace `private let spineWidth: CGFloat = 44` with:

```swift
    private var spineWidth: CGFloat { hSize == .regular ? 56 : 44 }
```

> If `spineWidth`/`booksPerRow` live in a different child struct than the one with the environment, add `@Environment(\.horizontalSizeClass) private var hSize` to that struct too, or pass the computed values down via an initializer parameter. Do not read the environment in a struct that isn't a `View`.

- [ ] **Step 2: Make the skeleton loader match the computed row count**

Find the skeleton `ForEach(0..<5, id: \.self)` (~line 402) and its inner `[168, 176, 162, 172, 165][i]` height array (which assumes 5). Replace with a count-driven version:

```swift
            ForEach(0..<booksPerRow, id: \.self) { i in
                let heights: [CGFloat] = [168, 176, 162, 172, 165]
                RoundedRectangle(cornerRadius: 6)
                    .fill(.white.opacity(0.08))
                    .frame(width: 44, height: heights[i % heights.count])
            }
```

- [ ] **Step 3: Remove the nested ScrollView**

In the `Shelves` subview, replace the inner `ScrollView { ... }` wrapper with the bare `VStack` it contains (the parent `signedInLanding` already provides a `ScrollView`). Keep the VStack's spacing/padding identical.

- [ ] **Step 4: Constrain the example card width**

Wrap the example card (`exampleSection`, ~lines 165-179) content with `.contentColumn(maxWidth: ContentWidth.form)` so it doesn't stretch on iPad.

- [ ] **Step 5: Build**

Run the standard build command. Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 6: Visual verify on iPad + iPhone**

iPad landscape: confirm ~9 spines per shelf row (not 5 with big gaps), wider spines, example card centered. iPhone portrait: confirm 5 spines per row, 44pt spines — unchanged from baseline.

```bash
xcrun simctl io booted screenshot /tmp/ipad-bookshelf-landscape.png
```

- [ ] **Step 7: Commit**

```bash
git add ios-native/MyBookLab/Views/BookshelfView.swift
git commit -m "feat(ios-native): size-class-driven shelf rows/spines + constrained example card"
```

---

## Task 5: Gallery grid tuning — `GalleryView`

**Files:**
- Modify: `ios-native/MyBookLab/Views/GalleryView.swift:81` (grid columns), grid container (~lines 80-115)

- [ ] **Step 1: Widen the adaptive grid and cap/center it**

Replace the grid definition at line 81:

```swift
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 16)], spacing: 20) {
```

with a bounded adaptive grid:

```swift
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 160, maximum: 220), spacing: 16)], spacing: 20) {
```

Then wrap the `LazyVGrid` with `.frame(maxWidth: ContentWidth.wide).frame(maxWidth: .infinity)` so the grid centers on very wide screens instead of spreading thin.

- [ ] **Step 2: Build**

Run the standard build command. Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 3: Visual verify**

iPad landscape: confirm cards are a comfortable size (not sparse), grid centered. iPhone portrait: confirm column count/card size matches baseline (160 minimum still yields the same 2 columns at iPhone widths).

- [ ] **Step 4: Commit**

```bash
git add ios-native/MyBookLab/Views/GalleryView.swift
git commit -m "feat(ios-native): bounded gallery grid, centered on wide screens"
```

---

## Task 6: Create wizard — `CreateBookView`

**Files:**
- Modify: `ios-native/MyBookLab/Views/CreateBookView.swift` (emoji grid ~278, emoji button ~283, illustration frame ~711, text editor ~722, cover preview ~847, step max-widths ~138/465-564, detents ~445)

- [ ] **Step 1: Add size-class environment**

Add to `CreateBookView` (and any child struct that owns the emoji grid):

```swift
    @Environment(\.horizontalSizeClass) private var hSize
```

- [ ] **Step 2: Make the emoji grid adaptive**

Replace the fixed 4-column grid at line 278:

```swift
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 12) {
```

with:

```swift
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: hSize == .regular ? 6 : 4), spacing: 12) {
```

- [ ] **Step 3: Grow the page editors on iPad**

- Illustration box (line ~711): change `.frame(height: 200)` to `.frame(height: hSize == .regular ? 360 : 200)`.
- Text editor (line ~722): change `.frame(minHeight: 160)` to `.frame(minHeight: hSize == .regular ? 260 : 160)`.
- Cover preview (line ~847): change `.frame(width: 200, height: 200)` to `.frame(width: hSize == .regular ? 320 : 200, height: hSize == .regular ? 320 : 200)`.

- [ ] **Step 4: Constrain wide step content to a readable column**

For the step container(s) that currently use only `.padding(.horizontal)` (e.g. the root step `VStack` around line 138 and the setting/title steps ~465-564), apply `.contentColumn(maxWidth: ContentWidth.form)` to the step content so it doesn't sprawl on iPad. Do **not** wrap the emoji grid in the cap (it should keep using the available column width).

- [ ] **Step 5: Offer a large detent on the parental gate**

At line ~445, change:

```swift
                .presentationDetents([.medium])
```

to:

```swift
                .presentationDetents([.medium, .large])
```

- [ ] **Step 6: Build**

Run the standard build command. Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 7: Visual verify on iPad + iPhone**

iPad: walk the wizard — emoji grid shows 6 columns, page editor/illustration/cover are larger, step text is in a centered column. iPhone portrait: 4 columns, original editor sizes — unchanged from baseline.

```bash
xcrun simctl io booted screenshot /tmp/ipad-create-portrait.png
```

- [ ] **Step 8: Commit**

```bash
git add ios-native/MyBookLab/Views/CreateBookView.swift
git commit -m "feat(ios-native): iPad-adaptive create wizard (grids, editors, column width)"
```

---

## Task 7: Checkout form — `PrintOrderView`

**Files:**
- Modify: `ios-native/MyBookLab/Views/PrintOrderView.swift` (root VStack ~45-66, shipping form ~200-214, hardcoded State width 90 at ~208)

- [ ] **Step 1: Add size-class environment**

```swift
    @Environment(\.horizontalSizeClass) private var hSize
```

- [ ] **Step 2: Constrain the whole form to a readable column**

Wrap the root form `VStack` (the content inside the ScrollView, ~lines 45-66) with `.contentColumn(maxWidth: ContentWidth.form)`.

- [ ] **Step 3: Fix the address layout and remove the hardcoded State width**

In `shippingForm` (~200-214), remove the arbitrary `.frame(width: 90)` on the State field (line ~208). Lay out City/State/ZIP/Phone as a two-column grid on iPad, stacked on iPhone:

```swift
            if hSize == .regular {
                HStack(spacing: 12) {
                    field("City", text: $city)
                    field("State", text: $state)
                }
                HStack(spacing: 12) {
                    field("ZIP", text: $zip)
                    field("Phone", text: $phone)
                }
            } else {
                field("City", text: $city)
                field("State", text: $state)
                field("ZIP", text: $zip)
                field("Phone", text: $phone)
            }
```

> Use the existing `field(_:text:)` helper and the real `@State` bindings as named in the file (confirm names while reading; the snippet assumes `city`, `state`, `zip`, `phone`).

- [ ] **Step 4: Build**

Run the standard build command. Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 5: Visual verify on iPad + iPhone**

iPad: form is a centered column; City/State and ZIP/Phone are paired side-by-side; no stray narrow State field. iPhone portrait: fields stack full-width — unchanged from baseline.

- [ ] **Step 6: Commit**

```bash
git add ios-native/MyBookLab/Views/PrintOrderView.swift
git commit -m "feat(ios-native): constrained checkout form + paired address fields on iPad"
```

---

## Task 8: Column-constrain Account / Orders list / Order detail

**Files:**
- Modify: `ios-native/MyBookLab/Views/AccountView.swift` (signed-in content ~43-54, signed-out ~238-260)
- Modify: `ios-native/MyBookLab/Views/OrdersListView.swift` (LazyVStack ~42-51)
- Modify: `ios-native/MyBookLab/Views/OrderDetailView.swift` (main VStack ~21-41)

- [ ] **Step 1: AccountView — constrain content**

Wrap the signed-in `ScrollView`'s content `VStack` (~43-54) with `.contentColumn(maxWidth: ContentWidth.form)`. Wrap the signed-out `VStack` (~238-260) the same way.

- [ ] **Step 2: OrdersListView — constrain the list**

Wrap the `LazyVStack` of order cards (~42-51) with `.contentColumn(maxWidth: ContentWidth.reading)`. Wrap the signed-out / empty / error states the same way if they aren't already inside the same container.

- [ ] **Step 3: OrderDetailView — constrain content**

Wrap the main content `VStack` (~21-41) with `.contentColumn(maxWidth: ContentWidth.form)`.

- [ ] **Step 4: Build**

Run the standard build command. Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 5: Visual verify on iPad + iPhone**

iPad landscape: Account cards, the orders list, and the order timeline/summary/address all sit in centered readable columns (not edge-to-edge). iPhone portrait: all three unchanged from baseline.

```bash
xcrun simctl io booted screenshot /tmp/ipad-account-landscape.png
xcrun simctl io booted screenshot /tmp/ipad-orders-landscape.png
```

- [ ] **Step 6: Commit**

```bash
git add ios-native/MyBookLab/Views/AccountView.swift ios-native/MyBookLab/Views/OrdersListView.swift ios-native/MyBookLab/Views/OrderDetailView.swift
git commit -m "feat(ios-native): content-column constraints for account, orders, order detail"
```

---

## Task 9: Adaptive card grids — `PaywallView` + `CoinStoreView`

**Files:**
- Modify: `ios-native/MyBookLab/Views/PaywallView.swift` (plan cards `VStack` ~130-136; sheet detents — see note)
- Modify: `ios-native/MyBookLab/Views/CoinStoreView.swift` (art styles `VStack` ~90-94)

- [ ] **Step 1: Paywall — plan cards in an adaptive grid**

Replace the plan-card `VStack(spacing: 12) { ForEach(...) { planCard(...) } }` (~130-136) with:

```swift
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 300, maximum: 400), spacing: 12)], spacing: 12) {
                ForEach(/* existing packages */) { pkg in
                    planCard(package: pkg)
                }
            }
```

> Keep the exact `ForEach` source and `planCard` call as written in the file. On a narrow sheet this still renders one column; on wide it goes side-by-side.

- [ ] **Step 2: Paywall — allow a large detent**

If `PaywallView` (or its presenter) sets `.presentationDetents`, include `.large`. If it is presented via `NavigationStack { PaywallView(...) }.sheet`/`.fullScreenCover` without detents, add `.presentationDetents([.medium, .large])` to the sheet content so iPad users get a roomy sheet. (Confirm the presentation site while reading; if it's already `.large`/full, no change.)

- [ ] **Step 3: CoinStore — art styles in an adaptive grid**

Replace the art-styles `VStack(spacing: 12) { ForEach(AvatarStyle.purchasable) { ... } }` (~90-94) with:

```swift
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 320, maximum: 420), spacing: 12)], spacing: 12) {
                ForEach(AvatarStyle.purchasable) { style in
                    // keep the existing per-style card view exactly
                }
            }
            .frame(maxWidth: ContentWidth.wide)
            .frame(maxWidth: .infinity)
```

- [ ] **Step 4: Build**

Run the standard build command. Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 5: Visual verify on iPad + iPhone**

iPad: paywall plans and coin-store styles render multiple cards per row on wide layouts. iPhone portrait: single column — unchanged from baseline.

- [ ] **Step 6: Commit**

```bash
git add ios-native/MyBookLab/Views/PaywallView.swift ios-native/MyBookLab/Views/CoinStoreView.swift
git commit -m "feat(ios-native): adaptive plan/style card grids on iPad"
```

---

## Task 10: Avatar editor + avatar sizing

**Files:**
- Modify: `ios-native/MyBookLab/Views/AvatarEditorView.swift` (emoji grid ~237 count 5, preview ~98/102 size 160, photo button ~145/150)
- Modify: `ios-native/MyBookLab/Views/AccountView.swift` (the `AvatarView(... size:)` call site, ~line 242 region)

- [ ] **Step 1: AvatarEditor — size-class environment + adaptive emoji grid**

Add `@Environment(\.horizontalSizeClass) private var hSize` to `AvatarEditorView`. Replace the fixed 5-column grid at line ~237:

```swift
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 5), spacing: 12) {
```

with:

```swift
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: hSize == .regular ? 7 : 5), spacing: 12) {
```

- [ ] **Step 2: AvatarEditor — scale the preview, cap the photo button**

- Avatar preview (lines ~98 and ~102): change both `.frame(width: 160, height: 160)` to `.frame(width: hSize == .regular ? 200 : 160, height: hSize == .regular ? 200 : 160)`.
- Photo-picker button (~145/150): add `.frame(maxWidth: 400)` so it doesn't stretch on a wide sheet.

- [ ] **Step 3: AccountView — larger profile avatar on iPad**

At the `AvatarView(...)` call (the profile card, ~line 242 uses a 96pt avatar), add an environment read to `AccountView` if not present (`@Environment(\.horizontalSizeClass) private var hSize`) and pass a larger size on iPad:

```swift
                AvatarView(/* existing args */, size: hSize == .regular ? 120 : 96)
```

> `AvatarView` already accepts `size:`; no change to the component itself.

- [ ] **Step 4: Build**

Run the standard build command. Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 5: Visual verify on iPad + iPhone**

iPad: avatar editor shows 7 emoji columns and a 200pt preview; account profile avatar is 120pt. iPhone portrait: 5 columns, 160pt preview, 96pt profile avatar — unchanged from baseline.

- [ ] **Step 6: Commit**

```bash
git add ios-native/MyBookLab/Views/AvatarEditorView.swift ios-native/MyBookLab/Views/AccountView.swift
git commit -m "feat(ios-native): adaptive avatar editor grid/preview + larger iPad profile avatar"
```

---

## Task 11: Full cross-device verification pass

**Files:** none (verification + fixes only)

- [ ] **Step 1: iPad sweep — both orientations**

On iPad Pro 13" sim, screenshot every tab + reader + hero in portrait and landscape. Confirm: nothing stretches edge-to-edge, no oversized lone controls, grids fill the space, no clipping. Fix any view that still sprawls by applying the appropriate `.contentColumn(...)`.

```bash
for s in books gallery create orders account reader hero; do
  echo "Capture $s portrait then landscape"; done
```

- [ ] **Step 2: iPad mini sweep**

Repeat key screens on **iPad mini (A17 Pro)** to confirm the `regular`-width branches also look right on the smallest iPad (column counts shouldn't overflow).

- [ ] **Step 3: iPhone regression gate**

On **iPhone 15** portrait, screenshot the five tabs + reader and compare against `/tmp/iphone-baseline-*.png` from Task 0. They must be visually equivalent. Then check **iPhone 15 Pro Max landscape** (regular width) and standard iPhone landscape (reader spread) — confirm the wide/aspect branches read well; if the reader spread is cramped on the phone, add the `geo.size.width > 700` guard from Task 2 Step 4.

- [ ] **Step 4: Functional smoke test**

On iPad: sign in, create a book through the wizard, open it in the reader, toggle read-aloud, open the paywall and coin store, start a print order. Confirm no broken interactions introduced by the layout changes.

- [ ] **Step 5: Final commit (only if fixes were needed)**

```bash
git add -A ios-native/MyBookLab/Views
git commit -m "fix(ios-native): final iPad/iPhone layout polish from verification pass"
```

- [ ] **Step 6: Hand off for review**

Use superpowers:requesting-code-review (or open a PR) summarizing: shared primitives, reader spread, hero, and per-view adaptive changes, with the iPad + iPhone screenshots attached.

---

## Notes for the implementer

- **iPhone safety is the gate.** Every iPad branch keys off `hSize == .regular` or a landscape aspect check. iPhone portrait is always `compact` width → it resolves to the pre-change path. If any task makes you change iPhone-portrait output, you've over-reached — narrow the branch.
- **Line numbers drift.** They are from the pre-change files; always re-read the file region before editing and match on surrounding code, not the number.
- **Don't read `@Environment` outside a `View`.** If a metric lives in a non-View helper struct, pass the size class / computed value in as a parameter instead.
- **Preserve existing styling.** For the reader and hero redesigns, graft the real existing subviews (gradients, `SparkleButton`, wordmark modifiers) into the new layout — only sizes and arrangement change.
