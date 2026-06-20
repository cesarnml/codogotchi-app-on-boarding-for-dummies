---
title: "07 — Hands-on Challenges"
---

> Goal: stop reading, start touching. These are ordered easy → hard. Each says
> what it teaches, the files, the steps, and **how to verify**. Do them in order;
> later ones assume the muscle memory of earlier ones.
>
> You learn this codebase by *changing it and watching what happens*, not by
> staring. Break things on purpose — `git stash` / `git checkout .` is your undo.

---

## Setup: build, run, and drive the pet

You need these three moves before any challenge. (Source:
[`apps/menubar/README.md`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/README.md).)

**Build & run from the terminal:**
```bash
bun run mac:build                 # = xcodebuild … build
open build/DerivedData/Build/Products/Release/Codogotchi.app
# look top-right: a pawprint / pet icon appears in the menu bar
```
…or just open the project in Xcode and hit ▶:
```bash
open apps/menubar/Codogotchi.xcodeproj
```

**Run the unit tests:**
```bash
bun run mac:test                  # xcodebuild … test
```

**Drive the pet without touching the real `state.json`.** The app reads a
*preview override* file every tick (`PreviewOverrideReader` in
[`LivePollingDriver.swift:470`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/LivePollingDriver.swift#L470)).
Write one and the running app reacts within a second:
```bash
mkdir -p "${TMPDIR}codogotchi-preview"
cat > "${TMPDIR}codogotchi-preview/state-override.json" <<'JSON'
{ "activity_state": "implementing",
  "since": "2026-01-01T00:00:00Z",
  "expires_at": "2030-01-01T00:00:00Z" }
JSON
# delete the file to hand control back to the live poller:
# rm "${TMPDIR}codogotchi-preview/state-override.json"
```

**Ready-made demo drivers** live in `scripts/` — read them, they're short and
teach the env knobs:
```bash
scripts/test-codogotchi-idle-bumps.sh frustrated   # launch already-frustrated
scripts/test-codogotchi-hud.sh                     # pin + sweep the RPG HUD
scripts/test-codogotchi-revive.sh                  # the heart-gain celebration
```

🧪 **Warm-up (do this first):** run the build, `open` the app, then use the
preview-override trick to cycle the pet through `idle` → `implementing` →
`errored` → `green_tdd`. Watch the menu-bar icon *and* (after Show Floating Pet
from the menu) the floating sprite. You've now seen the whole render pipeline
respond to a file write — the thesis of Chapter 01, live.

---

## Challenge 1 — Change a string the user sees *(≈15 min)*
**Teaches:** the enum-as-data idea (Ch.02); the build/run loop.

`ActivityState` carries its own UI copy. Change the label for one state.

1. In [`ActivityState.swift`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/ActivityState.swift),
   find `displayLabel` and change `case .implementing: return "Coding"` to
   `return "Cooking 🍳"`.
2. `bun run mac:build` && relaunch.
3. Drive the pet to `implementing` (preview-override trick). The floating pet's
   **animation badge** now reads "Cooking 🍳".

**Verify:** the badge text changed. **Reflect:** you edited a method *on an enum
case* — no class, no view code. That's the ADT-with-functions pattern from Ch.05.
`git checkout .` when done.

---

## Challenge 2 — Make the pet escalate faster *(≈15 min)*
**Teaches:** env-driven config; the idle-escalation feature; reading
`resolve(environment:)` (Ch.02 `IdleEscalationConfig`).

The pet gets "impatient" then "frustrated" the longer it's idle — normally at 10
and 30 minutes. Compress that to seconds.

1. Read `IdleEscalationConfig.resolve(...)` in `ActivityState.swift` — note it
   reads `CODOGOTCHI_IDLE_IMPATIENT_MS` / `CODOGOTCHI_IDLE_FRUSTRATED_MS`.
2. Launch with tiny thresholds + force the float on screen:
   ```bash
   CODOGOTCHI_IDLE_IMPATIENT_MS=5000 \
   CODOGOTCHI_IDLE_FRUSTRATED_MS=10000 \
   CODOGOTCHI_FLOAT_ON_LAUNCH=1 \
   open -n build/DerivedData/Build/Products/Release/Codogotchi.app
   ```
   (Or just read `scripts/test-codogotchi-idle-bumps.sh`, which does the
   backdate-the-clock version.)
3. Leave it alone. Within ~5s the badge → "Impatient", ~10s → "Frustrated".

**Verify:** escalation happened in seconds. **Reflect:** the production timings
are *defaults*, overridable from the environment purely for testing — a pattern
you'll reuse constantly. No code change, no rebuild.

---

## Challenge 3 — Add a platform to the attribution map *(≈30 min)*
**Teaches:** the exact file v2 leans on; how `origin` → a visual; the closed-map
+ `nil` fallback pattern. **This is a v2 dry-run.**

`PlatformAttribution` maps `source_event.origin` strings to a logo chip.

1. Read [`PlatformAttribution.swift`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/PlatformAttribution.swift)
   in full (45 lines).
2. Add a fake platform. In the `init?(origin:)` switch add
   `case "zed": self = .zed` and add a `case zed = "PlatformZed"` to the enum and
   a `displayName`. It won't have a real asset — that's fine for the exercise;
   it'll fail to find an image and draw no chip, which itself is informative.
3. Drive a state with that origin via preview override is *not* enough (override
   doesn't set origin) — instead temporarily hand-write `~/.codogotchi/state.json`
   with `"source_event": { "origin": "zed", "kind": "tool_use", "name": "x" }`
   and the required v6 fields, or just unit-test it (next step is cleaner).
4. **Better:** write a test. In `Tests/MenubarTests/PlatformAttributionTests.swift`
   add `XCTAssertEqual(PlatformAttribution(origin: "zed"), .zed)` and run
   `bun run mac:test`.

**Verify:** the test passes. **Reflect:** you just touched the precise lookup v2
uses to route a slice to a pet. In v1 this string picks a *chip*; in v2 it picks
a *pet*. `git checkout .` after.

---

## Challenge 4 — Red→green a pure function (TDD) *(≈30–45 min)*
**Teaches:** the test seams; that the "smart" logic is pure and testable without
AppKit (Ch.03); XCTest mechanics (Ch.05).

`HalfHeartDecayEngine.displayed(written:lastActivityAt:now:)` computes the
*displayed* hearts from elapsed time. Pin a behavior with a test.

1. Read [`HalfHeartDecayEngine.swift`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/HalfHeartDecayEngine.swift)
   (26 lines) and the decay constants in
   `packages/contracts/src/decay-constants.ts`.
2. In `Tests/MenubarTests/HalfHeartDecayTests.swift`, add a test that injects a
   fixed `now` and a `lastActivityAt` far in the past, and asserts the displayed
   hearts dropped below `written`. Use a deterministic `Date` — never `Date()` —
   so the test is reproducible.
3. Run it. If it passes first try, *change the assertion to a wrong value* and
   confirm it fails — prove your test actually exercises the code.

**Verify:** red when wrong, green when right. **Reflect:** `now` is injected
exactly so tests can control the clock — the same dependency-injection-of-a-
function pattern (`now: () -> Date`) you saw threaded through `LivePollingDriver`.

---

## Challenge 5 — Instrument one tick of the loop *(≈30 min)*
**Teaches:** the read→decide→emit flow (Ch.03) by *watching it run*; the
debug-logging-when-stuck habit.

1. In `LivePollingDriver.runTick()`
   ([line 202](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/LivePollingDriver.swift#L202)) add:
   ```swift
   NSLog("TICK result=\(result) ")
   ```
   and in `emit`, log when `renderChanged` fires:
   ```swift
   if renderChanged { NSLog("EMIT state=\(outcome.state) mode=\(outcome.mode)") ; … }
   ```
2. Build, run, open **Console.app**, filter for `TICK` / `EMIT`.
3. Hold the pet in one state for 30s. Count `TICK` lines (≈30) vs `EMIT` lines
   (≈1).

**Verify:** ticks fire every second; emits only on change. You've *seen*
change-gating, not just read about it. **Reflect:** strip the logs when done
(the project convention: instrument when stuck, remove after).

---

## Challenge 6 — Add a brand-new `ActivityState` end-to-end *(≈1–2 hrs, the capstone)*
**Teaches:** the compiler-driven exhaustive-switch payoff (Ch.02/05), the
**schema lockstep** (Ch.02), and the full producer↔consumer contract. This is the
single best exercise for "where everything connects."

Goal: add a state `refactoring` and make the pet show it.

1. **TS side (contract):** add `"refactoring"` to the activity-state enum in
   `packages/contracts/src/animation-state.ts`. Run `bun test packages`.
2. **Swift side (enum):** add `case refactoring = "refactoring"` to
   `ActivityState`. **Now build** — the compiler will *walk you to every
   exhaustive `switch`* that must handle it (`displayLabel`, `isInFlight`, …).
   This compiler-as-todo-list is the entire point; experience it.
3. **Art mapping:** decide which spritesheet row it uses. Add it to a row map in
   `CodexPet.swift` or `CodogotchiPet.swift` (reuse an existing row, e.g.
   `implementing`'s, so you don't need new art).
4. **Drive it:** preview-override `"activity_state": "refactoring"`.
5. **Verify:** the pet renders (the row you mapped) and the badge shows your
   `displayLabel`. If it shows *idle* instead, you hit the unknown→idle fallback —
   meaning a string mismatch between TS and Swift. Find it. (That debugging *is*
   the lesson.)

**Bonus — feel the lockstep gotcha on purpose:** bump only the TS
`STATE_JSON_SCHEMA_VERSION` to 7, rebuild the hook, and watch the Swift app gray
out (`.schemaNewer`). Then bump `EXPECTED_STATE_SCHEMA_VERSION` to match and
watch it recover. You will never forget the lockstep rule after doing this once.

`git checkout .` / reset the schema constants when done.

---

## Challenge 7 — Sketch the v2 routing (design, no full impl) *(≈1 hr)*
**Teaches:** consolidates Ch.06; turns reading into a concrete plan.

In a scratch branch, **stub** (don't fully build) the per-platform fan-out:

1. In `PetStateFanout.swift`, change `applyToFloatingPet: Apply` to
   `applyToFloatingPet: [String: Apply]` (keyed by origin) and update `apply` to
   route by a passed-in origin. Let the compiler show you everyone who breaks.
2. Follow the breakage into `MenubarApp` (the fan-out construction ~line 228) and
   `LivePollingDriver.emit` (where origin is known). You don't have to make it
   compile — the goal is to *see the blast radius the type system reveals*.
3. Write your findings as a checklist comment. Compare to the table in
   [Ch.06](./06-v2-per-platform-multipet.md). What did you find that the doc
   missed? (Add it — this KB grows; see the README.)

**Verify:** you can list, from memory, the files v2 touches and why.
`git checkout .` — this was reconnaissance.

---

## Challenge 8 — Fix the `tcis` "stuck frustrated" bug (a REAL one you hit) *(≈1–2 hrs)*
**Teaches:** that "where the bug *feels*" ≠ "where the bug *is*"; that env config
is read once at launch and lives for the whole process; that idle escalation is
*derived*, not *set* — so it can't be cleared from outside, only out-waited or
re-timed. This is the most valuable debugging exercise in the doc because the
fix is **not** in the Swift.

### The symptom (as observed)
After `tcis` ([`test-codogotchi-idle-set`](./09-dev-workflow-shell-helpers.md),
the idle-escalation demo) finishes its run, the pet is **stuck animating
frustrated**. Worse: even after a real activity animation plays, or you force her
back to idle with a mouse click-hold, she **slips back to frustrated within
seconds**. The only known fix is "turn it off and on again" — quit and relaunch
the app.

### Your goal
Make `tcis` do what you *intend*: demonstrate the idle → impatient → frustrated
climb in compressed time, then **leave the app behaving normally** afterward — no
reboot required.

### Investigate first (don't read the hints yet)
Answer these in order; each narrows the search:
1. Is the pet stuck on a stale *animation frame*, or is the *app* still deciding
   to be frustrated every few seconds? (How would you tell them apart?)
2. When a real activity hits, does the code leave frustrated? When it returns to
   idle, what re-arms? (Re-read `FloatingPetScene.update` and `maybeEscalateIdle`.)
3. `tcis` launches the app with two environment variables. *When* are they read,
   and *for how long* do they stay in effect? (Re-read `IdleEscalationConfig.resolve`
   — [Ch.02](./02-the-data-contract.md).)
4. Why does `tcib` (`scripts/test-codogotchi-idle-bumps.sh`) **not** have this
   problem, even though it also starts the pet escalated? What does it do
   *differently* from `tcis`?

### Hints — unfold one at a time, only when stuck

<details><summary>Hint 1 — reframe the symptom</summary>

She isn't *frozen* on a frame. She's being **re-escalated on a timer**, correctly,
over and over. So stop looking for "what's stuck" and start asking "what keeps
*deciding* frustrated is right?" The decision lives in `maybeEscalateIdle()`,
which runs every frame tick while idle and compares elapsed-idle time to a
**threshold**. So: what set that threshold, and is it still set?
</details>

<details><summary>Hint 2 — follow the threshold's lifetime</summary>

`tcis N` exports `CODOGOTCHI_IDLE_IMPATIENT_MS = N×1000` and
`CODOGOTCHI_IDLE_FRUSTRATED_MS = N×2000`. `IdleEscalationConfig.resolve()` reads
those **once, at launch**, and the resulting config is held by the scene for the
**entire process lifetime**. Nothing ever restores production timing (10 min /
30 min). So after the demo, *every* idle stretch ≥ 2N seconds re-escalates to
frustrated — permanently, until the process restarts. That's why reboot "fixes"
it: a clean relaunch reads production timing.
</details>

<details><summary>Hint 3 — why mouse de-escalation doesn't hold</summary>

`decrementIdleEscalation()` (click-hold) steps frustrated→impatient and
re-anchors the idle clock to that level's *floor*. But with the compressed
thresholds still in force, the floor + a few seconds of idle re-crosses the
frustrated threshold almost immediately. You stepped down into a window only
seconds wide. The de-escalation works; the *timing* defeats it.
</details>

<details><summary>Hint 4 — where the fix actually lives, and its shape</summary>

The Swift is behaving exactly as designed. **The bug is in the `tcis` shell
function's design**: it bakes permanent escalation-compression into a long-lived
process. Two honest fix shapes (pick based on what you want `tcis` to *be*):

- **Shell-only (recommended first):** make `tcis` two-phase. Phase 1: launch
  compressed, `sleep` through the climb (~2N + a buffer) so you can watch it.
  Phase 2: quit and **relaunch with no escalation env vars** (production timing
  restored). Mirror how `tclb`/`tcle` clean up after themselves, and how `tcib`
  keeps production timing. You write this in `~/.zshrc`; no Swift change.
- **Swift-altitude (stretch):** today escalation timing is *only* settable at
  launch. Add a **runtime** override — a watched sentinel file like the existing
  `hud-pin` mechanism (see `MenubarApp` ~line 352) — so a demo can compress, then
  restore, without relaunching. Bigger, touches the architecture you're learning,
  and arguably the "right" product fix. Don't start here; earn it.

Note `tcib` avoids the whole problem by using `CODOGOTCHI_IDLE_BACKDATE_MS` with
**production** thresholds — it backdates the *clock*, not the *windows*, so after
you de-escalate it takes the real 30 min to climb again. Study why that design
sidesteps the bug entirely.
</details>

### Success criteria
- Run your fixed `tcis 3`: you watch idle → impatient → frustrated in seconds.
- When the demo ends, leave the pet idle. After ~a minute she is **still idle**
  (not frustrated). Trigger a real activity, return to idle — she stays idle.
- You did **not** have to quit/relaunch manually.
- You can explain, in two sentences, why the original behaved the way it did and
  why your fix avoids it.

⚠️ This one edits `~/.zshrc` (your personal file), not the repo — that's the
point: the fix belongs at the layer where the bug lives.

---

## Challenge 9 — Build `tcs` (`test-codogotchi-sick <n>`) that *holds* a sick state *(≈2–3 hrs)*
**Teaches:** that health-driven visuals (like ghost, ch.09) can't use the preview
channel; how to **hold** a state against a file that live agents constantly
rewrite (a re-asserting background daemon + a `stop` subcommand — a pattern none
of your existing helpers have); the decay→displayed→sickness chain; and
half-hearts vs full hearts. This is the most ambitious helper in the doc.

### The spec (your words)
`tcs <n>` puts her in the desired heart-health **sickness** state — the green
haze + flies overlay — and **keeps her there** until you run `tcs stop`.
Sickness has two non-dead tiers: "little sick" and "very sick."

### Investigate first
1. What input actually drives the green-haze/flies effect? Find `SicknessLevel`
   and *where it's computed from* a number. (Start: `FloatingPetScene.swift`,
   then `FloatingPetPanelController.applyRPGState`.)
2. Which **heart counts** map to "little sick" vs "very sick" vs dead? Are those
   numbers **half-hearts or full hearts**? (Read `SicknessLevel(halfHearts:)`
   carefully — and `MAX_HALF_HEARTS`.)
3. Can the preview-override channel (`tclb`/`tcle`) carry that number? Why or why
   not? (Re-read the **ghost exception**, [Ch.09](./09-dev-workflow-shell-helpers.md).)
4. If you write the number into `~/.codogotchi/state.json` once, name **two**
   separate reasons it won't stay put.

### Hints — unfold only when stuck

<details><summary>Hint 1 — what to set, and where it must be set</summary>

The effect is `SicknessLevel(halfHearts:)` → `scene.setSicknessLevel(...)`, called
from `applyRPGState` ([`FloatingPetPanel.swift:237`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/FloatingPetPanel.swift#L237)).
That data comes from the poll loop reading **`half_hearts` in the real
`state.json`** — *not* the preview channel (which only carries `activity_state`,
exactly like ghost couldn't be previewed). So `tcs` must write the real
`~/.codogotchi/state.json`, like `_codogotchi_ghost_demo` does. Thresholds (note:
these are **half-hearts**, 0–6, where 6 = 3 full hearts):
`3–4 → warning` (light), `1–2 → critical` (heavy), `0 → dead/ghost` (not sick),
`5–6 → healthy`.
</details>

<details><summary>Hint 2 — why one write won't hold (two reasons)</summary>

1. **Live clobbering:** every live Claude/Codex hook event rewrites `state.json`,
   stomping your `half_hearts` within seconds (the same reason demos use the
   preview channel — which you can't here).
2. **Decay:** the renderer shows the *decayed displayed* hearts
   (`HalfHeartDecayEngine.displayed(written, last_activity_at, now)`), not your
   raw written value. With a stale `last_activity_at`, displayed hearts drift
   *below* what you wrote, so she'd slide from warning → critical → dead on her
   own.

So holding a state means **re-asserting it on a loop**, and each write must keep
`last_activity_at` fresh.
</details>

<details><summary>Hint 3 — the shape (stop here — write the rest yourself)</summary>

A daemon + a switch:

- **`tcs <n>`:** start a **background loop** (`nohup … & disown`, like `tcis`) that
  every ~1–2 s does a read-modify-write on `~/.codogotchi/state.json` (reuse the
  python block from `_codogotchi_ghost_demo`): set `half_hearts = n`,
  `last_activity_at = now` (defeats decay), `schema_version = max(6, current)`
  (RPG fields require ≥5), and **preserve** the existing `activity_state`. Record
  the loop's PID to `$TMPDIR/codogotchi-sick.pid`.
- **`tcs stop`:** read that pid file, `kill` the loop, remove the file. (Optional:
  restore a backup of the pre-`tcs` `half_hearts`, like the ghost demo's
  sentinel-guarded restore.)
- **Validate `n`:** reject/redirect `0` (that's dead → use the ghost demo) and
  `5–6` (not sick). Decide your arg convention and *document it*: pass half-hearts
  (0–6) directly, **or** accept full hearts (0–3) and ×2 internally — your call,
  but be consistent with how the HUD reads to you.

Known limitation (state it, like ghost does): the read-modify-write races live
hook writes; an occasional tick may be lost. Fine for a demo tool.
</details>

### Success criteria
- `tcs 4` → light green haze + a few flies, and she **stays** there even while you
  keep coding with a live agent running.
- `tcs 2` → heavier green + more flies (critical).
- `tcs stop` → re-asserting halts; the next real activity restores her true HP.
- `tcs 0` is rejected or routed to the ghost demo (dead ≠ sick).
- You can explain why this needs a daemon when `tclb` didn't (preview channel vs
  real-file contention + decay).

⚠️ Edits `~/.zshrc`, not the repo. And you're writing the *real* `state.json` —
keep the read-modify-write tight and `last_activity_at` fresh.

---

## Challenge 10 — "Minimalist mode": the badge without the pet *(≈3–5 hrs, a real feature)*
**Teaches:** that the platform chip + activity badge are *already* a standalone
`NSPanel` decoupled from the sprite; how a runtime config flag is plumbed
config → Settings → controller → panel (a pattern you can copy from the RPG-HUD
toggle); and the difference between *positional* and *lifecycle* coupling. This is
the most product-shaped challenge — it's a feature a real user wants.

### The vision (yours)
Some devs don't want a pet character — they want the **signal**: the platform logo
+ what the agent is doing right now, in a tiny always-on chip. "The floating-pet
badge, without the pet." Build a **minimalist mode** where the floating surface
shows only the **PlatformBadge + AnimationBadge** — no sprite, minimal real estate.

### Investigate first
1. Is the activity badge part of the sprite, or its own window? Find
   `AnimationBadgePanel` and how it's created/shown. (Is the platform chip
   separate from the activity label, or one unit?)
2. What exactly couples the badge to the pet today? Read `repositionAndShow‑
   AnimationBadge` and `AnimationBadgePanel.reposition(...)` — what does it need
   from the pet to position itself?
3. How does an existing runtime toggle reach the panel? Trace the **RPG-HUD
   enable** switch: `PetConfig.resolvedRPGHUDEnabled()` →
   `SettingsWindowController.onRPGHUDEnabledChanged` → `MenubarApp` →
   `floatingPetController.setRPGHUDEnabled(...)` → panel. That chain is your
   template.
4. In minimalist mode, what does the badge anchor *to* if there's no visible pet?

### Hints — unfold only when stuck

<details><summary>Hint 1 — the badge is already standalone</summary>

`AnimationBadgePanel` ([`FloatingPetPanel.swift:1016`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/FloatingPetPanel.swift#L1016))
is its **own** borderless floating `NSPanel` — it does *not* contain the sprite.
It draws the platform chip **and** the activity-label pill together (one unit,
configured via `reposition(label:platform:inFlight:…)`). So "PlatformBadge +
AnimationBadge" already ships as a single independent window. You're not building a
new view — you're letting it live without the pet.
</details>

<details><summary>Hint 2 — the coupling is only position + lifecycle</summary>

The badge isn't *rendered* by the scene; it's just (a) **positioned relative to
the pet's frame** (`AnimationBadgeLayout.frame(relativeTo: petFrame, …)`) and (b)
**shown/hidden with the pet** (`show()` calls `repositionAndShowAnimationBadge()`;
`hide()` orders it out). So decoupling = give it a frame to anchor to *without* a
visible sprite. The persisted placement already exists in `app-state.json`
(`FloatingAppState.frame`, Ch.01/05) — that's your anchor region even when no pet
is drawn.
</details>

<details><summary>Hint 3 — the config→panel plumbing to copy</summary>

Mirror the RPG-HUD toggle exactly:
- add `resolvedMinimalistEnabled()` to `PetConfig` (reads the same config file),
- add a Settings switch + an `onMinimalistChanged` callback on
  `SettingsWindowController` (copy the RPG-HUD switch in the RPG/General tab),
- wire it in `MenubarApp` to a new `floatingPetController.setMinimalist(_:)`,
- which forwards to the panel.

You now have a runtime flag the panel can read.
</details>

<details><summary>Hint 4 — the fix shape (two altitudes; pick the first)</summary>

**Altitude 1 (recommended first cut):** in `show()`, gate the **scene/sprite
creation** behind the minimalist flag — skip building `FloatingPetScene` and the
RPG HUD; keep the (now empty, transparent) pet panel for *placement/drag/
persistence* and keep `repositionAndShowAnimationBadge()`. Result: only the badge
is visible, but you still drag the invisible region to move it, and position
persists. Smallest diff; reuses all the placement machinery.

⚠️ UX wrinkle to notice: an invisible draggable region is awkward (nothing to
grab). Acceptable for v1 of the mode; note it.

**Altitude 2 (stretch, the "right" version):** promote `AnimationBadgePanel` to a
first-class draggable, persisted surface — anchor to its *own* frame, make it
draggable (it currently `ignoresMouseEvents`), persist *its* position. More work,
but it's what the feature deserves, and it's the natural shape for the **v2**
per-platform world: N little chips, one per active platform, no pets at all.

Stop here and build Altitude 1. Don't gold-plate.
</details>

### Success criteria
- A config/Settings toggle flips "minimalist mode" at runtime (or at least next
  launch).
- With it on: only the platform chip + activity label show; no sprite, no RPG HUD;
  the chip still updates platform + activity live (drive it with `tca`/preview
  overrides).
- With it off: the pet returns, unchanged.
- You can explain why this was *mostly wiring*, not new rendering (the badge was
  already a standalone panel — Hint 1).

### Why this matters beyond the challenge
This is a credible product mode (minimalist users) **and** a v2 stepping stone:
once the badge stands alone, "one chip per active platform" (Ch.06) is a small
leap from "one pet per platform." Note that synergy in your findings.

⚠️ This one **does** touch the repo Swift (`FloatingPetPanel`, `PetConfig`,
`SettingsWindowController`, `MenubarApp`) — work on a branch, run `bun run mac:test`.

---

## Challenges 11–14 — the bite-sized batch

These are smaller than 8–10 on purpose, and lightly hinted (one seam each) — you've
got the rhythm now. All are v2-roadmap items (#11–#15); #15, the activity HUD, is
roadmap-only until it has a product definition. Recommended order is as listed —
easiest/highest-value first.

### Challenge 11 — "Zzz" force-to-idle button *(≈1.5–2.5 hrs · high value)*
**The bug:** interrupt a prompt manually and the hook fires no "done" event, so
she sticks in the last activity state. **Build:** a small Zzz control beneath the
XP ring that force-toggles idle; visible only when state ≠ idle.

**The seam (most of it already exists):** `StateJsonWriter.dismissAttention`
([`StateJsonWriter.swift`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/StateJsonWriter.swift))
*already* writes `activity_state="idle"` preserving other fields. Generalize it to
`forceIdle(at:)`, add a tiny button view to the HUD, wire the tap to call it
(`MenubarApp` already passes the state path around — see `onAttentionDismissed`),
and show/hide the button on `currentState == .idle`.

<details><summary>Hint — visibility + the write target</summary>

The panel already tracks `currentState`. Drive the button's `isHidden` off
`currentState != .idle`, refreshed wherever `apply(state:)` lands. For the write,
reuse the `dismissAttention` pattern (read-modify-write JSON, `activity_state =
"idle"`, atomic write) against the same `state.json` path the poller reads — the
next 1 Hz tick picks it up and the fanout repaints. No new polling needed.
</details>

**Done when:** during a stuck state, the Zzz appears; tapping it returns her to
idle within ~1 s; it's gone when she's already idle. **Lead:** you (or me if you
want it shipped fast — it's a real bug).

### Challenge 12 — Idle-escalation progress in the AnimationBadge *(≈2–3 hrs)*
**Build:** make the badge visibly "fill up" toward the next idle escalation
(idle→impatient→frustrated) so the user can act before she gets grumpy.

**The seam:** the elapsed-idle clock is `idleSince` + `IdleEscalationConfig`
thresholds in `FloatingPetScene` (see `maybeEscalateIdle`,
[Ch.03](./03-the-polling-loop.md)/Challenge 8). Compute an **elapsed-fraction**
toward the next threshold, plumb it to `AnimationBadgePanel`, and draw a fill
(reuse the procedural-draw approach from [Ch.11](./11-procedural-effects-deep-dive.md),
or a simple bar/ring in the badge view). Only meaningful while `state == .idle`
and `supportsIdleEscalation`.

**Done when:** sitting idle, the badge fills smoothly and resets/steps at each
escalation; nothing shows when she's active. Pair it with `tcis` (Challenge 8) to
watch it in compressed time. **Lead:** you (good procedural-draw rep).

### Challenge 13 — XP-ring click-to-cycle metrics *(formatter ≈45 min · full feature medium-high)*
**Build:** clicking the XP ring cycles XP% → total token count (`1.2K`/`1.2M`/`1.2B`,
1-decimal, dynamic label) → ETA-to-next-level.

**Start with the bite-size, pure-function core:** a token **number formatter**
(`12_300 → "12.3K"`, `1_200_000 → "1.2M"`, `3_400_000_000 → "3.4B"`). Write it
test-first (`bun run mac:test`) — your FP wheelhouse. There's already a
`formatNumber` in `packages/cli/src/status.ts` to learn from / mirror.

**The surfacing step (smaller than it looks).** XP% and a rough ETA come straight
from `level_fraction`, already in `state.json`. The raw **token count already
exists** too — the CLI tracks it as `cumulative_claude_tokens` /
`cumulative_codex_tokens` in `~/.local-xp-cache.json` (`LocalXpCache` in
[`local-xp-writer.ts`](https://github.com/cesarnml/codogotchi/blob/main/packages/cli/src/local-xp-writer.ts)). It just
isn't *surfaced* into `state.json` (it's not in `V5Fields`). Two ways to expose it:

- **(a) through the contract (clean):** add the count to `V5Fields` + the
  `state.json` write in `hook-binary.ts` (~line 1176), **bump the schema**, and
  decode one new field in Swift. This is the exact **schema-lockstep dance** from
  [Ch.02](./02-the-data-contract.md) — a perfect low-stakes rehearsal for the v2
  schema work. `computeAndPersistV5Fields` already has the number in hand.
- **(b) read the cache directly (no bump):** Swift reads `~/.local-xp-cache.json`
  itself — fewer moving parts, but reaches into producer-private state (less clean,
  and the path/`CODOGOTCHI_HOME` resolution must match).

**Lead:** formatter you (TDD); the surfacing is collaborative — (a) is the better
rep because it teaches the lockstep you'll need for v2.

### Challenge 14 — Disable internal token-usage tracking (Settings > RPG) *(≈2–3 hrs, TS+Swift)*
**Build:** a privacy opt-out — hiding the HUD doesn't stop token→XP tracking;
add a real "don't track token usage" switch.

**The seam (two layers):** (1) Swift — add a `features.token_tracking` flag to
`PetConfig` and a Settings switch, copying the **`rpg_hud_enabled`** plumbing
end-to-end (`PetConfig` → `SettingsWindowController` → `MenubarApp` callback).
(2) TS (your turf) — the CLI must **honor** the flag and skip token→XP work in
`packages/cli`. The Swift side is the learning; the CLI side is home.

**Done when:** flipping it off stops new token-driven XP/level changes (verify via
CLI behavior + the HUD no longer advancing), and on restores it. **Lead:**
collaborative. Ties to the privacy posture (roadmap #3).

> **#15 (coding-activity HUD, hours/day)** is intentionally *not* a challenge yet —
> its metrics aren't defined. It's logged in the v2 roadmap as a stretch I'll lead
> after a product-definition pass. When you're ready to define what it should show,
> we'll turn it into a proper spec.

---

## A rule for all challenges

Coming from JS, your instinct is `console.log` everywhere. Here the equivalents
are **`NSLog(...)` → Console.app** for runtime, and **`bun run mac:test`** for
logic. Prefer a test over a log when the thing is pure (Ch.03's `decide`,
`HalfHeartDecayEngine`, `IdleEscalationConfig`) — it's faster and it stays.

➡️ Next: [08 — Swift learning resources](./08-swift-learning-resources.md).
