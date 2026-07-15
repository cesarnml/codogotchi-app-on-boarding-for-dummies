---
title: "10 — The Seams: Why v3 Wants a Redesign"
---

> Goal: read the v2 code *critically*. Each section names a seam — a place
> where the architecture creaks — with the symptom you can verify yourself,
> why it happened, and the shape v3 wants instead. Every seam ends with a
> 🗣️ **plain-English** translation — if the jargon version loses you, read
> those first, top to bottom: they're the whole argument in ordinary words.
> This is the technical case behind the v3 "architectural consolidation"
> track.

A framing note before the critique: v2 was built incrementally under a
deadline, feature by feature, and **it works** — well-tested (900+ tests),
well-commented, shipped. Nothing here is "this was dumb." Every seam below is
the normal sediment of accretion: each individual commit was locally
reasonable, and the sum is globally hard to reason about. That's exactly the
condition a consolidation release exists to fix — *before* v3 features pile
more weight on top.

---

## Seam 1 — Stringly-typed window keys

**Symptom.** Chapter 9's key ladder (`origin` / `origin:session_id` /
`"combined"`) is discriminated by string inspection, re-derived at every site
that needs it:

- `FloatingPetWindowPool.origin(forWindowKey:)` — colon-split
- `FloatingPetWindowPool.sessionIdentity(forWindowKey:)` — colon-split + `!= "combined"` guard
- `FloatingPetWindowPool.modeSwitchOrigin(forWindowKey:)` — `"combined"` guard + delegate to the above
- ad-hoc `origin == "combined"` / `key.firstIndex(of: ":")` checks in
  `MenubarApp`'s factory closures, `StateJsonWriter` call sites, the menu, and
  the pool's own `update()`

Every new affordance (mode switch, TTL refresh, hidden-key culling — all
v3-preview work) had to re-answer "which of the three shapes am I holding, and
what does that mean for *this* action?" from scratch.

🇹🇸 **TS analogy.** This is `type WindowKey = string` where the codebase needed
a discriminated union. In TS you'd write:

```ts
type WindowKey =
  | { kind: 'origin'; origin: string }
  | { kind: 'session'; origin: string; sessionId: string }
  | { kind: 'combined' }
```

…and the compiler would *force* every switch site to handle all three. Swift
enums with associated values are strictly better at this than TS unions —
v2 just never reached for one.

**v3 shape.** A `WindowKey` enum parsed **once** at the boundary (where render
keys enter the pool), with the string form demoted to a serialization detail
(`app-state.json` persistence, slice filenames). Land this *before* the
Sessions panel, which would otherwise become yet another colon-split site.

🗣️ **In plain English.** Every pet window is identified by a text label with
secret rules baked into the spelling — a colon means one thing, the exact word
"combined" means another. Nothing stops you from mis-reading a label, and every
new feature has to re-learn the spelling rules from scratch. v3 gives the three
kinds of window three real names the compiler knows, so mis-handling one
becomes a build error instead of a runtime bug.

---

## Seam 2 — The factory god-closures

**Symptom.** Open
[`MenubarApp.swift`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/MenubarApp.swift)
and find the two window factories passed to the pool. Each is a ~100-line
closure wiring 8–10 callbacks (`onForceIdle`, `onAttentionDismissed`,
`onRenameRequested`, `onPruneRequested`, `onSwitchToMinimalist` /
`onSwitchToPetMode`, `onPanelSizeChanged`, `onHideFloatingPet` /
`onHidePanel`, `onOpenSettingsRequested`, …). The Own and Minimalist factories
duplicate the same targeting logic — "session-keyed window → exactly its
slice; combined/plain → the window's origin set" — in parallel comment blocks
that must be kept honest by hand.

**Why it happened.** Each callback was added by the feature that needed it,
and the factory closure was always the nearest place with access to both the
panel and the app's services (state dir, pool, settings controller).

**v3 shape.** Extract the *decision* from the *wiring*: one small router type
owning "given this WindowKey and this user action, which slices/stores does it
touch" (the logic currently smeared across the closures), leaving the
factories as dumb `panel.onX = { router.handle(.x, for: key) }` lines. The
targeting rules get one home, one test suite, and the two factories stop being
parallel implementations.

🗣️ **In plain English.** All the "when the user clicks X, do Y" rules live
inside two giant tangles of setup code, and the two tangles are near-copies of
each other. Understanding any one button means reading a hundred lines of
unrelated wiring. v3 moves the rules into one small, testable rulebook and
leaves the setup code as boring one-liners.

---

## Seam 3 — Three-surface parity is maintained by hand

**Symptom.** Own pet windows (`FloatingPetInteractionView`), Minimalist strips
(`MinimalistBadgeView`), and their chrome panels each hand-roll the same
machinery: right-click prompt construction, dismissal observers (global
monitors + local monitors + resign-active), drag routing from chrome into the
host window, rename/prune alerts.

The receipts, from a single v3-preview session: the "clicks elsewhere in-app
don't dismiss the prompt" bug had to be fixed **three times** — once for the
Panel Size pill, then once each in the two view classes — because each surface
owns its own copy of the observer stack. The prompt-item lists are likewise
built in two `presentHidePrompt` implementations that drift (Own offers Prune;
Minimalist retitles Hide; both must remember the mode-switch pill).

**v3 shape.** One prompt/dismissal component owned by (or next to)
`FloatingPetPromptCoordinator` — a single observer stack, a single
`[PromptItem]` builder parameterized by window shape — with the views reduced
to "present at this anchor with these capabilities." Parity stops being a
code-review discipline and becomes a type.

🗣️ **In plain English.** The right-click menu is hand-built three separate
times — once per kind of window — so every fix and every new menu item must be
done three times, and forgetting one copy is silent. We know it's not
hypothetical: a recent bug literally shipped in one copy after being fixed in
another. v3 builds the menu once and hands it to all three windows.

---

## Seam 4 — `update()` interleaves policy and side effects

**Symptom.** The pool's `update()` is a 10-ish-step imperative pipeline where
TTL, last-active immunity, mode transitions, combined folding, session caps,
eviction, grandfather gating, hidden keys, and spawning interleave. It is
*extensively* commented — because it has to be. Any change means re-reading
the whole pipeline to find the step (and step-ordering invariant) you're
about to violate.

🇹🇸 **TS analogy.** It's a reducer that mutates the store *while* computing the
next state. What you'd want in FP terms:

```
derive : (Snapshot, Customization, Clocks, HiddenKeys) → DesiredWindows   // pure
diff   : (CurrentWindows, DesiredWindows) → [SpawnKey], [DismissKey], [UpdateKey]
apply  : effects only — factories, teardown, per-tick pushes
```

**v3 shape.** Exactly that split. The pure `derive` gets property-style tests
(feed it clocks and caps, assert the desired set) without stub window
controllers; the effectful tail shrinks to a mechanical differ. Most of the
current tests survive as-is against the composed whole.

🗣️ **In plain English.** The routine that decides which pets should be on
screen also *does* the showing and hiding, all in one long recipe — so you
can't check its decisions without actually opening windows, and changing one
step risks every step after it. v3 splits it into "decide" (a pure calculation
you can test with plain numbers) and "do" (a dumb executor). Same behavior,
far easier to change safely.

---

## Seam 5 — Config writers are multiplying

**Symptom.** `customization.json` is written by: the Settings tab's long-lived
`CustomizationTabViewModel`, plus a *fresh throwaway* `CustomizationTabViewModel()`
constructed inside every right-click handler (mode switch, Panel Size), with
`.customizationDidChangeExternally` as duct tape keeping the long-lived one in
sync. At two writers this is fine. The Sessions panel makes it three; hatch
or CLI integrations make it four.

**v3 shape.** A single `CustomizationStore` (read-merge-write + change
publication in one type; the VM becomes a view-facing adapter). Notification
duct tape becomes the store's actual API.

🗣️ **In plain English.** Several parts of the app edit the same settings file
independently and then shout "I changed it!" so the others can catch up. With
two editors that's manageable; v3 is about to add more. Better: one gatekeeper
owns the file, everyone asks it to make changes, and it tells subscribers
what changed — no shouting, no stale copies.

---

## Seam 6 — The flat `Sources/` directory

**Symptom.** `ls apps/menubar/Sources` — 63 Swift files at one level: readers,
writers, view models, panel controllers, SpriteKit scenes, pollers, pruners,
and the app entry point, discoverable only by naming convention. And some
files bundle several unrelated types: `FloatingPetPanel.swift` alone contains
both panel controllers, both badge views, the entire right-click prompt
system, and the Panel Size pill — 4,000+ lines.

**Why it happened.** xcodegen's `project.yml` globs the directory, so a new
file lands wherever `touch` puts it, and nothing ever forced a second level.

**v3 shape.** Group by the layers this guide already teaches: `State/` (the
disk contract — readers, writers, pruners), `Pool/` (window pool, render
keys, session policy), `Windows/` (panel controllers, chrome, prompts),
`Scene/` (SpriteKit + effects), `Settings/` (tabs + view models), `App/`
(entry point, menu, polling driver). Mechanically cheap — globs still match,
imports are module-internal, so it's file moves only — and it's a natural
forcing function to split the multi-type files. Do it *first* in the
consolidation phase, before other refactors multiply the diff noise of
moving files later.

🗣️ **In plain English.** All 63 source files sit in one folder, like a filing
cabinet with a single drawer — you find things only if you already know their
names, and some "files" are really five documents stapled together. v3 sorts
them into half a dozen labeled drawers matching how the app actually works.
Cheap to do, and the biggest single win for anyone new to the codebase.

---

## Case study: how the seams compound

The best illustration is a real v3-preview bug chain. "Show Pet" on a hidden,
TTL-expired session silently did nothing. Root cause analysis had to traverse
**all three clocks from Chapter 9** (dismiss TTL suppressing re-spawn; reader
staleness hiding the slice from the snapshot; prune horizon deleting the file
outright), the hidden-keys set that lives *outside* those clocks, and the
string-keyed targeting rules for which slice to rewrite. The fix landed in
four places: a new writer variant (`refreshForShow`), menu wiring, app wiring,
and a menu-open culling pass for the fully-pruned case.

None of those clocks is wrong individually. But **no single type owns "what
states can a session be in"** — the Active/Live/Archived/Pruned diagram in
Chapter 9 exists only in this guide and in code comments. When lifecycle is
implicit, every feature that touches it (Show, Hide, prune, session caps, the
upcoming Sessions panel) re-discovers it by debugging.

🗣️ **In plain English.** A pet quietly lives through four ages — on screen,
recently active, dormant, gone — but the code never says so anywhere; the ages
only emerge from three unrelated timers interacting. So a simple-sounding
button ("Show my pet") turned into a four-part bug hunt. v3 writes the ages
down as a first-class concept and then shows them to the user as the Sessions
panel — the same fix serving both the code and the product.

---

## The v3 tracks, in one breath

From the roadmap (`notes/private/codogotchi-v3-polish-roadmap.md` in the main
repo):

1. **UX gap-closing** — ongoing on `v3_preview` (mode-switch affordances,
   Panel Size pill, dismissal contracts, TTL-refresh-on-Show, zombie-entry
   culling).
2. **Distribution** — notarized DMG → Sparkle auto-updates + Homebrew cask →
   App Store investigation (sandboxing vs the hook-install model is the open
   question).
3. **Sessions panel** — Chapter 9's lifecycle diagram as a Settings tab
   (Active / Live / Archived), with per-row Show/Prune.
4. **Consolidation** — the seams above, sequenced so refactors land where they
   unblock features: `WindowKey` before the Sessions panel; the prompt
   component before any new affordance; `derive/diff/apply` opportunistically.

No big-bang rewrite. Each seam pays its own way or waits.

> **Update:** Track 4 (phases 16–18) plus the immediate sequels (19–20) have
> landed. Read [Chapter 13](/13-v3-as-built/) for the as-built map and a
> seam-by-seam ledger of what closed. Track 2 (distribution) is still open.

---

## Prove it to yourself

1. Do Chapter 9's exercise 3 (`grep -rn '"combined"' apps/menubar/Sources`).
   Classify each hit: parse site, policy decision, or serialization. How many
   would a `WindowKey` enum delete outright? *(After Chapter 13: re-run and
   confirm policy hits are gone.)*
2. Diff the two `presentHidePrompt` implementations in
   `FloatingPetPanel.swift` (Own's `FloatingPetInteractionView` vs
   `MinimalistBadgeView`). List every behavioral difference, then decide for
   each: intentional (window-shape capability) or drift (nobody noticed)?
   *(After Chapter 13: the two implementations are gone — audit against
   `window-capability-matrix.md` instead.)*
3. Sketch the `DesiredWindows` value type for Seam 4 — what fields does it
   need so `apply` requires *zero* additional policy decisions? Check your
   sketch against the real `update()` steps: anything you missed is a policy
   the current code hides inside an effect. *(After Chapter 13: compare your
   sketch to `Pool/Derive/`.)*
