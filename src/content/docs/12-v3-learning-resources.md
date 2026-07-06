---
title: "12 — v3 Learning Resources"
---

> Goal: the Chapter 08 treatment for v3's new territory. v2 needed Swift
> fluency; v3 needs two different literacies — **refactoring legacy-ish Swift
> safely** (the consolidation track) and **macOS distribution plumbing**
> (notarization, Sparkle, App Store, Homebrew). Tiered by urgency, tagged with
> *why it matters here*.
>
> ⚠️ Same caveat as Chapter 08: links rot, training data has a cutoff — prefer
> the search queries over stale URLs. Apple's docs and the Sparkle project are
> stable publishers; exact paths move.

---

## How to use this page

- **Tier 0** if you're doing the consolidation refactors (Seams 1–5, Ch.10).
- **Tier 1** when the distribution track starts (notarize → Sparkle → cask).
- **Tier 2** for the App Store investigation — read *before* promising it.
- **Tier 3** — depth you don't need to ship v3.

---

## Tier 0 — Refactoring the v2 seams

**1. Swift enums with associated values + exhaustive switch (official book,
*Enumerations* + *Patterns*).** The `WindowKey` refactor (Seam 1) is this one
language feature applied firmly. You read this for v2; re-read it now asking
"what does the compiler prove when there's no `default:`?"
*Why here:* Challenge 6 of Chapter 11 is the dry run.

**2. "Working Effectively with Legacy Code" (Feathers) — the
characterization-test chapters.** The pool's `update()` has 900+ tests, which
is the luxury case: the book's *seam* vocabulary (his word — Chapter 10
borrowed it) tells you how to split `derive`/`diff`/`apply` without a
big-bang. Search: `feathers characterization tests seam`.
*Why here:* Seam 4 is a textbook "extract pure core from an effectful method."

**3. Point-Free's "Composable Architecture" episodes — the *ideas*, not the
library.** State-as-value, effects at the edges, exhaustive tests over pure
reducers. We are *not* adopting TCA; we're stealing the derive-then-apply
discipline for `FloatingPetWindowPool`. Search: `pointfree reducers value
state`.
*Why here:* it's the FP framing (your home turf) for Seam 4's split.

**4. Swift API Design Guidelines (swift.org).** Short. Read before naming
`WindowKey` / the action router / the customization store — v3's whole point
is that the next reader can *guess* what things do.

---

## Tier 1 — Notarize, Sparkle, cask (the distribution track)

**5. Apple: "Notarizing macOS software before distribution" +
`notarytool` docs.** The pipeline is: Developer ID certificate → codesign
with hardened runtime → `notarytool submit --wait` → `stapler staple`.
Search: `apple notarytool staple hardened runtime`.
*Why here:* Track 2 step 1; everything else gates on this. The deliverable is
~30 lines added to `scripts/package-dmg.sh`.

**6. Sparkle 2 documentation (sparkle-project.org).** Read the *Basic Setup*
and *Publishing an update* pages; understand the appcast XML, EdDSA signing
(`generate_keys` / `sign_update`), and the sandboxed-vs-not decision before
writing any code. Search: `sparkle 2 appcast eddsa sandbox xpc`.
*Why here:* Track 2 step 2. Gotcha to hold onto: the App Store build (if it
ever ships) must *exclude* Sparkle — plan the target/config split early.

**7. Homebrew cask cookbook + `brew audit --cask`.** A cask is ~15 lines of
Ruby pointing at a stable versioned URL with a sha256 — the work is release
hygiene (predictable URLs, which the notarized-DMG step should produce), not
Ruby. Search: `homebrew cask cookbook new cask pr`.
*Why here:* Track 2 step 4; cheap once notarization lands.

---

## Tier 2 — The App Store investigation

> Start with [Chapter 17](/17-app-store-requirements/) — the requirements
> primer grounded in this codebase — then use these for depth.

**8. App Sandbox documentation (Apple) — entitlements, security-scoped
bookmarks, and the temporary-exception list.** Codogotchi reads/writes
`~/.codogotchi` and installs hooks into *other apps'* config directories;
stock sandboxing forbids both. Read with Ch.09's producer/consumer split in
mind and ask which halves can live inside the sandbox at all.
Search: `app sandbox security-scoped bookmarks user-selected file access`.
*Why here:* this is the go/no-go input for Track 2 step 3. The likely answer
is a distinct product shape (companion CLI does the hook installs; the app
stays sandboxed) — treat that as a design exercise, not a checkbox.

**9. "LSUIElement apps on the Mac App Store" — review-guideline folklore.**
Menu-bar-only apps are approvable, but floating always-on-top panels across
Spaces plus login items have review history worth reading. Search:
`mac app store review menu bar app LSUIElement floating window rejected`.

---

## Tier 3 — Later / optional

**10. WWDC sessions on XPC and privileged helpers.** Only if the App Store
companion-CLI shape gets serious.

**11. `xcodes` / CI signing (fastlane match or raw `security` keychain
scripting).** When release automation moves off the laptop — post-v3 unless
releases become frequent.

---

## A one-week ramp (v3 edition)

| Day | Do | Outcome |
| --- | --- | --- |
| 1 | Ch.09 + Ch.11 Challenges 1–3 | v2-as-built is muscle memory |
| 2 | Ch.10 + Challenges 4–5 | you've *felt* two seams break |
| 3 | Tier 0 #1 + Challenge 6 | `WindowKey` prototype compiles |
| 4 | Tier 0 #2–3 + Challenge 7 | `derive/diff/apply` sketch reviewed |
| 5 | Tier 1 #5 skim; run `codesign -dv` on a local build | you can read the current signing state |
| weekend | Challenge 8 + the v3 roadmap note | you can scope a v3 phase yourself |
