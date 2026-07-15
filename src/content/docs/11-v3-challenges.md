---
title: "11 — v2 → v3 Hands-on Challenges"
---

> Goal: stop reading, start touching — the v3 edition. Chapters 09–10 gave you
> the shipped v2 architecture and its seams; [Chapter 13](/13-v3-as-built/) shows
> what consolidation actually shipped. These challenges still make you *feel*
> the pre-refactor pain before you read the as-built map cold. Same rules as
> Chapter 07: ordered easy → hard, each says what it teaches, the files, and
> **how to verify**. Hints are tiered — unfold one at a time, only when stuck.
>
> Prereqs: Chapters 09–10, plus the build/run/preview-override moves from
> Chapter 07's setup section. Work on a branch; several of these are
> deliberately throwaway. After finishing, skim Chapter 13 and re-check which
> exercises the landed types make obsolete.

---

## Challenge 1 — Watch the slice directory live *(≈15 min, no code)*
**Teaches:** the state.d contract (Ch.09) with your own eyes.

1. `ls -la ~/.codogotchi/state.d/` — match filenames to `origin:session_id`.
2. In one terminal: `watch -n1 'ls -lt ~/.codogotchi/state.d | head'` (or
   `fswatch`). In another, run a short Claude Code prompt.
3. Watch your session's slice mtime tick, then `cat` it mid-run and after.

**Verify:** you saw `activity_state` change and `updated_at` advance, and you
can name which slice is the "winner" for the origin right now (freshest
`updated_at`).

---

## Challenge 2 — Trigger all four lifecycle tiers on purpose *(≈30 min, no code)*
**Teaches:** the Active / Live / Archived / Pruned diagram (Ch.09) as a real
thing, not a picture; the three clocks.

1. Set the dismiss TTL to 1 minute (Settings → Customization).
2. Get a pet on screen (**Active**), then let it idle out (**Live** — not
   rendered, slice fresh).
3. Backdate a *copy* of a slice to fake **Archived**:
   ```bash
   touch -t $(date -v-3H +%Y%m%d%H%M) ~/.codogotchi/state.d/<slice>.json
   ```
4. Use the menubar "Show" on each tier and observe: Live → reappears with its
   state; Archived → reappears as **idle** (the `refreshForShow`
   stale-slice rule); a deleted slice → the menu entry itself disappears on
   next open.

**Verify:** you predicted each Show outcome *before* clicking. If any
surprised you, re-read Ch.09's lifecycle table.

### Hints — unfold one at a time
<details><summary>Hint 1 — why does Archived come back idle?</summary>

`StateJsonWriter.refreshForShow` resets `activity_state` to idle only when the
slice's mtime is past the reader's 2h staleTTL — a state that old describes a
session that will never emit a correcting event. Fresh slices keep their state.
</details>

<details><summary>Hint 2 — the menu entry vanished — where did that happen?</summary>

`MenubarMenu` is its own `NSMenuDelegate`; `menuWillOpen` calls the pool's
`pruneHiddenKeysWithoutBackingSlice(stateDirectory:)` before rebuilding the
pet section.
</details>

---

## Challenge 3 — Count the string-key blast radius *(≈30 min, no code)*
**Teaches:** Seam 1 (stringly-typed window keys) as measured fact, not vibes.

1. `grep -rn '"combined"' apps/menubar/Sources | wc -l`, then read each hit.
2. Same for `firstIndex(of: ":")` and `sessionIdentity(forWindowKey:)` call
   sites.
3. Classify every hit: **parse** (string → meaning), **policy** (a decision
   keyed on the shape), or **serialization** (writing the string form).

**Verify:** you have three lists. The parse list is what a `WindowKey` enum
deletes outright; the policy list is what it turns into exhaustive `switch`es
the compiler checks for you.

---

## Challenge 4 — Add a throwaway right-click affordance *(≈1–2 h)*
**Teaches:** Seam 3 (three-surface parity) by walking the exact path every
v3-preview affordance walked. **Throwaway branch — do not merge.**

Add a "Woof" pill to the right-click prompt that just `NSLog`s, on **both** the
Own pet window and the Minimalist strip.

1. Add a title constant to `FloatingPetHidePrompt`.
2. Own mode: `FloatingPetInteractionView.presentHidePrompt` + a handler
   property + wiring in `makeContentView`.
3. Minimalist: `MinimalistBadgeView.presentHidePrompt` + handler + wiring in
   `MinimalistPanelController.init`.
4. MenubarApp: wire both factories' panels to the log statement.

**Verify:** the pill appears and fires on both surfaces. **Reflect:** count
the files and the *parallel* edits you just made (the same feature, twice,
plus app wiring). That's the tax Chapter 10 wants to delete — one prompt
builder parameterized by window shape.

### Hints
<details><summary>Hint 1 — which existing pill to crib from</summary>

"Pet Mode" / "Minimalist Mode" (commit `293e2412`) is the smallest recent
example — grep for `minimalistModeTitle` and follow its wiring end to end on
both surfaces before writing anything.
</details>

<details><summary>Hint 2 — the prompt items are ordered</summary>

Both `presentHidePrompt` implementations build `items:` top-to-bottom with the
Hide action last. Slot "Woof" just above Hide and the stack sizing
(`FloatingPetHidePrompt.stackSize`) handles the rest.
</details>

---

## Challenge 5 — Break the TTL on purpose *(≈1 h)*
**Teaches:** the idle-frozen clock (Ch.09) and `update()`'s step ordering
(Seam 4) — by violating an invariant and watching the failure.

On a branch, make `lastSeenAt[renderKey] = currentTime` unconditional in
`FloatingPetWindowPool.update()` (remove the `!= .idle` guard), then run
`bun run mac:test`.

**Verify:** name the failing tests *before* running them (which behaviors
depend on the clock freezing?). Then explain in one sentence why an idle pet
would now never dismiss. Revert.

### Hints
<details><summary>Hint 1 — what does the guard actually implement?</summary>

"TTL-expired" means *continuously idle longer than the TTL*. If the clock
advances every tick regardless, `currentTime - lastSeen` is always ~one tick,
so `isTTLExpired` can never fire for a pet that's still being polled.
</details>

---

## Challenge 6 — Sketch `WindowKey` for real *(≈2 h, compiles but throwaway)*
**Teaches:** Seam 1's fix shape; Swift enums with associated values doing what
TS discriminated unions do (Ch.05).

1. In a new file, define
   `enum WindowKey { case origin(String); case session(origin: String, id: String); case combined }`
   with `init(parsing: String)` and `var storageKey: String` round-tripping
   the legacy strings.
2. Port **one** consumer: reimplement `modeSwitchOrigin(forWindowKey:)` as a
   `switch` over `WindowKey`.
3. Write the round-trip test: for each of the three shapes,
   `WindowKey(parsing: k).storageKey == k`.

**Verify:** tests pass; the `switch` has no `default:` — the compiler now
proves the three-way split every call site currently re-derives by hand.

---

## Challenge 7 — Derive the desired window set as a value *(design only, ≈2 h)*
**Teaches:** Seam 4's `derive / diff / apply` split, at whiteboard depth.

Without writing Swift: read `update()` top to bottom and write the type
signature and fields of the pure `DesiredWindows` value it *should* compute —
per key: shape (own/minimalist/combined-member), visibility, session number,
and everything `apply` would need to spawn or update with **zero further
policy decisions**.

**Verify:** cross-check your sketch against every step of `update()`. Each
step should map to either a `derive` input (clocks, caps, hidden keys, modes)
or an `apply` effect (spawn, dismiss, push state). Anything that maps to
neither is a policy hiding inside an effect — you've found another seam.

---

## Challenge 8 — Prototype one Sessions-panel row *(≈half a day)*
**Teaches:** the v3 Sessions panel's data problem (Ch.10, Track 3) end to end,
in miniature.

Build a throwaway function (test-only is fine) that scans `state.d/` and
returns `[SessionRow]` — origin, session id, label (from
`SessionLabelStore`), tier (Active / Live / Archived via pool state + mtime
against the two TTLs), and last-activity date. Unit-test it against a fixture
directory like `CustomizationTabViewModelTests` builds.

**Verify:** your test covers all three tiers plus the "hidden but fresh"
case — which tier did you put that in, and does the menubar's Show behavior
agree with your answer?

---

## Where to go next

You've now touched every seam v3's consolidation track names. Read the
roadmap (`notes/private/codogotchi-v3-polish-roadmap.md` in the main repo),
pick a Track 1 gap or the `WindowKey` refactor, and take it through the
normal SoA phase path. Chapter 12 has the external resources for the
distribution track (notarization, Sparkle, cask).
