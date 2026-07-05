---
title: "13 — Dev-Workflow Shell Helpers"
---

> Goal: grok the `codogotchi-*` / `tc*` shell functions you already use daily, so
> they stop being magic. Every one of them is a thin wrapper around a concept
> you met in chapters 02–04 — mostly *"write a file the app polls."* Understanding
> them is understanding the app's seams from the outside.
>
> ⚠️ These live in **`~/.zshrc`** (a managed personal file). This chapter
> *documents* them; don't expect edits here to change them. If you want to change
> a helper, edit `~/.zshrc` (or better, fold durable ones into a repo script).

---

## The big idea behind almost all of them

🗣️ **In plain English.** You don't need a real AI session to make the pet do
things — a handful of small scripts fake the signals: "pretend the agent is
coding," "pretend she's been ignored for an hour," "pretend a heart just came
back." This page catalogs those puppet strings, which every demo, screenshot,
and bug hunt uses.

Recall from [Ch.03](./03-the-polling-loop.md): the app polls `state.json` at 1 Hz,
**but** it first checks a higher-priority *preview override* file. From
`PreviewOverrideReader`
([`LivePollingDriver.swift:470`](https://github.com/cesarnml/codogotchi/blob/archive/v2.5.0/apps/menubar/Sources/LivePollingDriver.swift#L470)):

```
$TMPDIR/codogotchi-preview/state-override.json   ← if present + unexpired, WINS
$TMPDIR/codogotchi-preview/gate-override.json    ← gate equivalent
~/.codogotchi/state.json                          ← the real feed (fallback)
```

🧠 **Why a separate channel exists (this is the whole point).** You cannot demo by
writing `~/.codogotchi/state.json` directly — **every live Claude Code / Codex
session rewrites that file on each hook event**, clobbering your demo within
seconds. The preview override is a sandbox the live producer never touches, so a
demo state *sticks*. Your `tclb`/`tcle` helpers all drive this channel.

The override file shape is exactly `PreviewStateOverride` (Ch.03):
```json
{ "activity_state": "implementing",
  "since": "2026-…Z",
  "expires_at": "2026-…Z" }
```
…and the app treats it as expired (ignores it) once `expires_at` passes — which
is why your helpers set `expires_at = now + duration + 2s` (the **+2s** is slack
so the override doesn't expire *during* the `sleep` and flicker back to live).

---

## The helpers, grouped

### Group A — discovery (internal, `_`-prefixed)

| Function | What it does |
|---|---|
| `_codogotchi_repo_root` | Finds the repo: git top-level if it contains `scripts/codogotchi-animation-test.sh`, else `~/code/codogotchi`, else errors. |
| `_codogotchi_animation_test` | Runs `scripts/codogotchi-animation-test.sh` (the in-repo script) with your args. |

🧠 These exist so the user-facing helpers work from *any* directory and from any
worktree. Convenience plumbing; nothing app-specific.

### Group B — spritesheet animation tests (delegate to the repo script)

| Alias | Function | Effect |
|---|---|---|
| `tca <trigger>` | `test-codogotchi-animation` | drive **one** state via the repo script's `single` mode (persists ~30s) |
| `tcsa` | `…-soa-animations` | `cycle soa` — walk the SoA-tier states (10s each) |
| `tcca` | `…-codex-animations` | `cycle codex` — walk the Codex-sheet states |
| `tcla` | `…-lite-animations` | `cycle lite` — walk the Lite-tier states |

These call `scripts/codogotchi-animation-test.sh`, which writes the *same*
preview-override channel. 🧠 **Connection:** the three cycle modes (`soa` /
`codex` / `lite`) map 1:1 to the **tiered spritesheet model** from
[Ch.04](./04-the-renderers.md) — `CodogotchiPet.soaRowMap`, `CodexPet.rowMap`,
and the Lite sheets. Running them is a visual tour of each tier's row map.

### Group C — tier cycles, pure zsh (no repo script)

| Alias | Function | States it cycles |
|---|---|---|
| `tclb [secs]` | `test-codogotchi-lite-basic` | revive, standby, thinking, reading, implementing, testing, errored, waiting_for_input → then a **ghost** demo |
| `tcle [secs]` | `test-codogotchi-lite-enhanced` | cramming, editing, git_ops, verifying, searching, web_search |

Both call `_codogotchi_preview_cycle`, which loops the state list, writing the
override + `sleep`ing `secs` between each (default 3). 🧠 **The state lists *are*
the tier row maps** — `tclb`'s list is what the Lite-Basic sheet paints;
`tcle`'s is the Lite-Enhanced additions. If you ever wonder "which states does
tier X cover?", these helpers are the living answer.

### Group D — the ghost demo (the interesting exception)

`tclb` ends with `_codogotchi_ghost_demo`. **Ghost can't use the preview
channel** — and understanding *why* tests your Ch.02–03 knowledge:

> Ghosting is **heart-driven** (`half_hearts == 0`), but the preview override
> only carries `activity_state` — it has **no RPG fields**. So the override
> channel literally cannot express "dead." The helper must write the *real*
> `~/.codogotchi/state.json`.

Because it writes the real file (which live sessions clobber), it's **best-effort
and careful**:
1. `cp` the real state to a backup.
2. Set a zsh `trap … EXIT INT TERM` to restore on exit/Ctrl-C.
3. Write a ghost payload: `half_hearts=0, hp=0, hp_overlay="ghost"`, and a
   **sentinel** `source_event.name = "codogotchi-ghost-demo"`.
4. On restore, only put the backup back **if the current file still carries that
   sentinel** — i.e. nothing fresher overwrote it. If a live session wrote in the
   meantime, discard the backup and yield to the live write.

🧠 The sentinel-name check is a "did someone else touch this?" guard — a tiny but
real concurrency pattern. Worth internalizing: *don't blindly restore a backup
over a file other processes share.*

### Group E — idle escalation, live build (`tcis`)

`tcis [secs]` = `test-codogotchi-idle-set`. Unlike the others it **rebuilds and
relaunches the app** to exercise idle escalation under real timing, compressed:

1. `xcodebuild … -configuration Debug build` (logs to `$TMPDIR`).
2. Discover the build output via `xcodebuild -showBuildSettings` →
   `BUILT_PRODUCTS_DIR` (robust — never hardcodes a DerivedData path).
3. Quit any running instance (`osascript quit` + `pkill`).
4. Relaunch with env knobs (Ch.02 `IdleEscalationConfig.resolve`):
   `CODOGOTCHI_IDLE_IMPATIENT_MS = secs×1000`,
   `CODOGOTCHI_IDLE_FRUSTRATED_MS = secs×2000`, `CODOGOTCHI_FLOAT_ON_LAUNCH=1`,
   via `nohup … & disown` so it survives the shell closing.

🧠 So with `tcis 3`: impatient after 3s idle, frustrated after 6s. This is the
helper version of [Challenge 2](./07-challenges.md). Note the comment says
"seconds" while the var is named `duration_ms` — the input is seconds; the `×1000`
converts to the env var's milliseconds.

### Group F — release install (`cgi`)

`cgi [repo]` = `codogotchi-install`. The full **Release** ritual (matches the
macOS release runbook): pick repo (arg / git top-level / `~/code/codogotchi*`
worktree glob) → `bun install` if needed → quit app → `xcodegen generate` →
`xcodebuild archive` (Release) → `-exportArchive` via `ExportOptions.plist` →
back up the existing `/Applications/Codogotchi.app` → `ditto` the new one in →
`open` → print installed version. 🧠 This is "ship it to my real Applications
folder," distinct from the dev-build helpers above.

---

## zsh idioms in these helpers (so they read clearly)

Practical zsh you'll see here — learn these five and the functions decode:

| Idiom | Means | Why it's here |
|---|---|---|
| `trap '…' EXIT INT TERM` | run cleanup on normal exit, Ctrl-C, or kill | delete override files / restore backups so a demo never strands state |
| `setopt local_options local_traps` | scope `setopt`/`trap` changes to *this function* | don't leak demo traps into your interactive shell |
| `${(q)var}` | zsh **quote** flag — safely quote a value | bake quoted paths into the trap *string* (it's eval'd later) |
| locals gone at trap time | function locals are torn down *before* the EXIT trap runs | why traps recompute paths from `$TMPDIR` or bake in `${(q)…}` instead of using `$preview_root` |
| `${HOME}/code/codogotchi*(N-/)` | glob qualifiers: `N`=null-ok, `-`=follow symlinks, `/`=dirs only | enumerate worktrees without erroring when none match |

🇹🇸 **TS analogy.** `trap … EXIT` is a `try/finally` for the whole function.
`${(q)…}` is `JSON.stringify`-for-shell-safety. The "locals gone at trap time"
gotcha is like a stale closure capturing a variable that's already been
garbage-collected — so you snapshot the value *now* instead of referencing it
later.

---

## Quick reference card

```
# Drive ONE state (preview channel, ~30s)        repo script
tca implementing

# Tour a tier's animations (10s each)            repo script
tcsa     # SoA gate states
tcca     # Codex sheet states
tcla     # Lite states

# Tour a tier (Ns each, default 3) pure-zsh      preview channel
tclb [s] # Lite-Basic states + ghost
tcle [s] # Lite-Enhanced states

# Idle escalation, compressed (rebuilds Debug)
tcis [s] # impatient @ Ns, frustrated @ 2Ns

# Ship Release build → /Applications
cgi [repo]
```

**Cleanup if a demo strands state:**
```bash
rm -f "${TMPDIR}codogotchi-preview/state-override.json" \
      "${TMPDIR}codogotchi-preview/gate-override.json"
```

---

## 🧪 Prove it to yourself

1. **Watch the channel work.** Run `tca implementing`, then in another shell
   `cat "${TMPDIR}codogotchi-preview/state-override.json"`. You're looking at the
   `PreviewStateOverride` shape from Ch.03, on disk, winning over the live feed.

2. **Explain the ghost exception out loud.** Why does `tclb` use the override
   channel for 8 states but write the real `state.json` for the 9th (ghost)?
   (Because ghost is heart-driven and the override carries no `half_hearts`.) If
   you can answer this cold, you understand the preview channel's *limits*, not
   just its use.

3. **Trace one env knob end to end.** `tcis 3` sets
   `CODOGOTCHI_IDLE_IMPATIENT_MS=3000` → `IdleEscalationConfig.resolve` reads it
   → `FloatingPetScene` escalates after 3s idle → the badge shows "Impatient."
   Shell → env → Swift config → render. That's the same trace skill v2 needs.

➡️ Back to the [README / index](./README.md).
