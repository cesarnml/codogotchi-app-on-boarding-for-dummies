---
title: "17 — The ~/.codogotchi Disk Contract"
---

> Goal: the lookup card for every file the app reads or writes. Chapters 01–02
> teach the *idea* of the disk contract and Chapter 09 narrates how v2 uses it
> ([Chapter 13](/13-v3-as-built/) for the v3 overlay); this page owns the tables.
> Come back here whenever you need "who writes this
> file, who reads it, which timer governs it, and what breaks if I delete it."

Everything lives under **`~/.codogotchi/`**, overridable with the
`CODOGOTCHI_HOME` env var (every path below resolves through
[`CodogotchiFolders`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/CodogotchiFolders.swift)
— tests and demo mode point it at sandboxes). Demo mode additionally polls a
separate fixture directory and never touches the live one.

---

## The map

| File | Written by | Read by | Governing clock(s) |
| --- | --- | --- | --- |
| `state.d/<origin>:<session>.json` | **Hooks** (producer); app writes back narrowly | `StateJsonReader` (1 Hz) | reader 2h mtime · pruner 24h · pool dismiss-TTL |
| `state.d/….gate.json` / `….context.json` | son-of-anton gate writer | `GateJsonReader` | reader staleness |
| `customization.json` | Settings VM · right-click handlers | `CustomizationJsonReader` (pool, per tick) | none — settings |
| `app-state.json` | App (`AppStateStore`) | App | none — app state |
| `session-labels.json` | App (`SessionLabelStore`) | App (pool, menu) | orphan sweep w/ pruner |
| `rpg-state.json` | **CLI** (RPG engine) | App (HUD, hearts, level) | none |
| `prompt-attention.json` | **Hooks** | `PromptAttentionReader` | payload expiry |
| `assignments.json` | Settings (Pet tab) · pet installs | `AssignmentsJsonReader` | none — settings |
| `config.json` | Settings (`PetConfig`) | App | none — settings |
| `pets/` | Pet installs (gallery, hatch) | Pet loaders (`CodexPet`, `CodogotchiPet`) | none |
| `state-transitions.log` / `gate-transitions.log` | App (`TransitionLog`, NDJSON) | Humans / tooling | append-only + heartbeat |
| `state.json` *(legacy, v1)* | — (retired) | — (`LegacyStateFileCleanup` deletes it) | one-time cleanup |

Producer/consumer rule of thumb: **hooks and the CLI write the left half of
the app's world; the app writes the right half.** The one deliberate
exception is the app's narrow write-backs into `state.d/` (below).

---

## `state.d/` — the live state (the contract that matters most)

One JSON slice per `(origin, session)`, named `origin:session_id.json` —
**the filename is authoritative** (`StateJsonReader.parseSliceFilename`; a
plain `origin.json` parses as session `"default"`). Inside: the schema-6
shape from Chapter 02 (`activity_state`, `updated_at`, `source_event`,
optional `attention`).

**Writers.** Hooks own these files. The app writes back in exactly three
narrow cases ([`StateJsonWriter`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/StateJsonWriter.swift)),
always scoped to the clicked window's slice(s), never the whole directory:

| Write-back | Trigger | Touches stale slices? |
| --- | --- | --- |
| `forceIdle` | right-click Force Idle | **no** (would resurrect aged-out pets) |
| `dismissAttention` | dismissing the bubble | no |
| `refreshForShow` | menubar "Show …" / "Show All" | **yes — deliberately** (restarts the TTL clock; stale slices re-show as idle) |

**Clocks.** Three, independent (the lifecycle table in Chapter 09):

| Clock | Value | Effect |
| --- | --- | --- |
| Pool dismiss-TTL | `idle_dismiss_ttl_seconds` (default 300s, `0` = never) | continuously-idle pet leaves the screen; idle-frozen (busy pets never age) |
| Reader staleness | 2h mtime, hard-coded | slice becomes invisible to both readers |
| `SlicePruner` | 24h mtime, 30-min sweep timer | file deleted; orphaned `session-labels.json` keys swept with it |

**Sidecars.** `origin:session.gate.json` / `.context.json` carry SoA
ticket/gate badges and conflict context — separate polling path
(`GateJsonReader`), same filename identity, excluded from slice parsing.

**Delete one by hand?** Safe. The pet vanishes (menu entry culled at next
menu-open), rename label swept later. This is exactly what right-click
"Prune Session" does, plus label/number cleanup.

---

## `customization.json` — display settings

Full key table (defaults in
[`CustomizationJsonReader`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/CustomizationJsonReader.swift)):

| Key | Meaning | Default |
| --- | --- | --- |
| `platform_modes` | per origin: `own` · `combined` · `minimalist` · `off` | `own` |
| `session_pets_enabled` | per origin: session-keyed panels | off |
| `session_cap` | per origin: max session panels; `0` = unlimited | 3 |
| `session_pets_activated_at` / `session_pets_grandfathered_session_id` | the grandfather/activity gate (Ch.09) | — |
| `evict_session_pets_enabled` | newcomer may evict lower-ranked incumbent | true |
| `idle_dismiss_ttl_seconds` | dismiss-TTL; `0` = never | 300 |
| `idle_impatient_seconds` / `idle_frustrated_seconds` | badge escalation; `0` = never | 300 / 600 |
| `combined_minimalist_enabled` | combined window renders as a strip | false |
| `minimalist_badge_scale` | global strip scale (clamped 0.75–~1.16) | 1.0 |

Writes are **read-merge-write** (`ConfigFileWriter.merge`) so unknown keys
survive. Two writer families: the Settings tab's view model, and the
right-click affordances (mode switch, Panel Size) via short-lived view models
+ the `.customizationDidChangeExternally` notification. The pool never
subscribes — it re-reads per tick. Hand-edit freely; malformed content
degrades to defaults, never crashes.

---

## App-owned state

**`app-state.json`** (`AppStateStore`) — floating-window frames per window
key, the **hidden window keys** set (written through on every hide/show
toggle, because crash-exit is normal for a menubar app), onboarding
completion, hook install status. Delete it: windows return to default
positions, hidden pets un-hide, onboarding may re-offer. Harmless.

**`session-labels.json`** (`SessionLabelStore`) — right-click renames, keyed
by render key (`origin:session_id`, plain origin, or `combined`). Session
keys are swept when their slice disappears; plain-origin/`combined` renames
live until you change them.

**`config.json`** (`PetConfig`) — active pet name, RPG HUD toggle.

**`assignments.json`** — which installed pet renders for which platform
(Settings → Pet tab; also touched by pet installs).

**`pets/`** — the pet store: one directory per installed pet (sprite sheets +
metadata) consumed by the pet loaders. Deleting one uninstalls it.

---

## Producer-side inputs

**`rpg-state.json`** — hearts/level/active-minutes progression, written by
the CLI's RPG engine; the app only renders it (HUD, sickness, ghost).

**`prompt-attention.json`** — latest submitted-prompt summaries per session,
written by hooks; drives session-badge tooltips and attention subtitles.
Payloads carry their own expiry.

---

## Observability (append-only, safe to delete anytime)

**`state-transitions.log`** and **`gate-transitions.log`** — NDJSON, one line
per observed transition plus a periodic heartbeat
([`TransitionLog`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/TransitionLog.swift)).
Nothing reads them programmatically; they exist for humans debugging "what
did the app think happened."

---

## 🗣️ In plain English

The whole app is a conversation through one folder. Your AI tools leave notes
about what they're doing (`state.d/`, prompt summaries, RPG progress); you
leave instructions about how you want things shown (customization, pet
choice, renames); the app remembers its own housekeeping (window positions,
what you've hidden) and keeps a diary nobody has to read. Almost everything
is safe to peek at, hand-edit, or delete — the app is built to shrug and
carry on. The only files with real rules are the `state.d/` notes, where
three separate timers decide when a note is current, dormant, or trash.
