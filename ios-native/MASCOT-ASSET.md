# Adding the mascot artwork

`WelcomeBackMoment` (both platforms) shows a mascot. The art is **not in
the repo yet** — both copies fall back to an animated ⭐, so everything
builds and behaves correctly without it. This is a placeholder, not a
broken asset.

## What's needed

One square PNG of the mascot on a transparent background. Export at
**336×336 px** if you can only produce one size — it renders at 112×112
points, so that covers 3x and scales down cleanly.

## Where it goes

**iOS.** Open `MyBookLab.xcodeproj`, select `Assets.xcassets` → **Mascot**
in the navigator, and drag the PNGs onto the wells:

- 1x → 112×112 px
- 2x → 224×224 px
- 3x → 336×336 px

Dropping files into `Assets.xcassets/Mascot.imageset/` in Finder is *not*
enough — `Contents.json` has to name them, and Xcode writes that entry
for you when you use the catalog editor. The slots are intentionally
empty right now, so `UIImage(named: "Mascot")` returns nil and the star
renders instead. One file in the 3x well is fine; iOS scales it down.

**Web.** Save the same art as `public/mascot.png` in the repo root.
`src/components/ui/WelcomeBackMoment.jsx` requests it as `/mascot.png`
and swaps to the star via `onError` if it 404s. One file, no build step,
no code change.

## Verifying

Sign in and relaunch. The moment fires ~0.9s after launch, once per
session. On iOS, force-quit and reopen to see it again; on web, open a
new tab — it's keyed to `sessionStorage`.
