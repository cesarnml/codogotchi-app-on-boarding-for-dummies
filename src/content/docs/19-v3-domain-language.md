---
title: "19 — v3 Domain Language"
---

> Goal: the lookup card for the **names** Codogotchi v3.0.0 uses when it
> talks about itself. Chapter 13 narrates how those names landed; this page
> owns the dictionary. Come back here whenever a PR, issue, or code review
> uses a word and you need "what does that *mean*, and what must I not
> confuse it with?"

v3 did not invent a new product. It gave the product a **typed ubiquitous
language** — enums and layer names where v2 had string conventions and a flat
folder. Speak these words the way the code does and half of debugging becomes
"which noun am I holding?"

Canonical release: **v3.0.0** (notarized DMG + Sparkle). The vocabulary below
is what that cut ships; later patch releases (e.g. v3.0.1) did not rename it.

---

## One-breath map

| If someone says… | They mean… | Not… |
| --- | --- | --- |
| **slice** | one `state.d/<origin>:<session>.json` file | the floating window on screen |
| **origin** | a platform id (`claude_code`, `codex`, `cursor`, …) | a session id |
| **session** | one agent conversation / thread id | an origin |
| **WindowKey** | typed address of one floating render slot | the raw string still used on disk |
| **fold / combined** | several origins (or sessions) sharing one window | session pets |
| **SessionLifecycle** | Active / Live / Archived / Pruned | `ActivityState` (what the pet is *doing*) |
| **derive → diff → apply** | one poll-tick of the window pool | the hook writing a slice |
| **drawer** | one of the six `Sources/` layer folders | a UI panel |

🗣️ **In plain English.** Disk notes are *slices*. Platforms are *origins*.
Windows have typed *keys*. How busy the pet looks is *activity*; whether that
session still exists in Settings is *lifecycle*. Once a second the pool
*derives* who should be on screen, *diffs* that against reality, then *applies*
the effects.

---

## The six drawers

Every menubar Swift file lives in exactly one layer under
`apps/menubar/Sources/`. "Which drawer?" is the first question when locating
code:

| Drawer | Owns | Speak it as… |
| --- | --- | --- |
| **`App/`** | entry, menu, polling driver, demo | "the host / tick clock" |
| **`State/`** | disk contract — readers, writers, pruners, `CustomizationStore` | "what files say" |
| **`Pool/`** | `WindowKey`, `SessionLifecycle`, derive/diff/apply, router | "who should be on screen" |
| **`Windows/`** | panels, chrome, prompts, flock coordinator | "pixels and clicks" |
| **`Scene/`** | SpriteKit + pet loaders | "sprites and effects" |
| **`Settings/`** | tabs + view models (incl. Sessions) | "the preference UI" |

Edge rule from Phase 16: drawer = **who owns the type at runtime**, not what
the filename suggests (`RPGHUDPanel` → `Windows/`, `PlatformAttribution` →
`Pool/`). Narrative: [Chapter 13](/13-v3-as-built/).

---

## The key ladder (three addresses, one typed middle)

Half of v2/v3 debugging is still "which kind of key am I holding?" v3 keeps
three vocabularies and makes the middle one a real type:

```text
slice key          →  origin:session_id          (disk filename)
render key         →  after Customization        (session pets on/off, etc.)
WindowKey          →  .origin / .session / .combined   (pool + policy)
```

| Term | Form | Who speaks it |
| --- | --- | --- |
| **Slice key** | always `origin:session_id` on disk (plain `origin.json` → session `"default"`) | hooks, `StateJsonReader` |
| **Render key** | session-keyed or plain origin after consulting customization | `RenderKeyResolver` → pool input |
| **Window key** | one floating window; combined-mode origins fold to **`.combined`** | `WindowKey` enum |

`WindowKey` cases (parse once at the pool boundary; `rawValue` is serialization
only):

| Case | `rawValue` | Means |
| --- | --- | --- |
| `.origin("claude_code")` | `claude_code` | one window for that platform (session pets off, or fold to platform) |
| `.session(origin:id:)` | `origin:session_id` | one window for that exact conversation |
| `.combined` | `combined` | the shared multi-origin window |

**Reserved-value trap:** `.origin("combined")` and `.combined` both serialize to
`"combined"`. Construct cases directly when a reserved name is possible; do not
re-invent colon-splits at call sites. Deep dive: [Chapter 09](/09-v2-as-built/)
(ladder), [Chapter 13](/13-v3-as-built/) (typed middle).

🗣️ **In plain English.** Same pet, three labels: the sticky note on disk, the
label after settings are applied, and the named window kind the compiler knows.
Only the last one should appear in `switch`es.

---

## `SessionLifecycle` — four ages

Where a slice sits relative to clocks and the pool — **not** what animation it
shows:

| Case | Means | Typical user affordance |
| --- | --- | --- |
| **Active** | rendered now, or concealed-but-still-fresh | on screen / Hide seat kept |
| **Live** | fresh, neither rendered nor concealed | Show would resurrect |
| **Archived** | past reader staleness, short of prune horizon | Show or Prune |
| **Pruned** | at/past prune horizon | gone / about to be deleted |

Classifier inputs: `age`, `isRendered`, `isConcealed`, `liveTTL` (reader ~2h),
`archiveTTL` (pruner ~24h). Precedence is fixed: prune horizon wins; rendered ⇒
active; concealed-but-fresh ⇒ active; else live vs archived. One type feeds
Settings > Sessions and the menubar pet section.

Do **not** say "lifecycle" when you mean **`ActivityState`** (idle / implementing
/ …). Activity is mood/work; lifecycle is existence/eligibility.

---

## Pool verbs: derive → diff → apply

One poll tick of the window pool, spoken as three stages:

| Verb | Pure? | Output |
| --- | --- | --- |
| **`PoolDerive.derive`** | yes — no AppKit | `DesiredWindows` + next `PoolMemory` |
| **`PoolDiff`** | mechanical | spawn / dismiss / update (+ frame directives) |
| **`PoolApply`** | effects only | factories, teardown, per-tick pushes |

Related nouns:

- **`DesiredWindow` / `DesiredWindows`** — policy result for this tick, keyed by
  `WindowKey` (includes fold **winner** session identity after Phase 19).
- **`PoolMemory`** — pure fold state threaded across ticks (TTL clocks, session
  numbers, hidden keys, grandfather, …).
- **`WindowActionRouter`** — given `WindowKey` + user action, which slices/stores
  to touch (replaces factory god-closures).

🇹🇸 **TS analogy.** `derive` ≈ pure vnode computation; `diff`/`apply` ≈ commit.

---

## Window shapes and platform modes

**Modes** live in `customization.json` per origin (`platform_modes`):

| Mode | User-facing meaning |
| --- | --- |
| **own** | dedicated floating pet for that origin |
| **combined** | fold into the shared `.combined` window |
| **minimalist** | compact badge strip (no sprite / HUD) |
| **off** | no window for that origin |

**Shapes** on screen (what the pool spawns):

| Shape | Roughly |
| --- | --- |
| **Own pet** | SpriteKit pet in an `NSPanel` + chrome flock |
| **Minimalist strip** | content-tight badge row, no sprite |
| **Combined** | either of the above, keyed `.combined` |

**Fold / winner (Phase 19):** when several sessions share one window, the pool
elects a **winning** `(origin, sessionId)`. Prune, primary labels, and mode chip
follow that winner — not a silent no-op on a nil session identity.

**Session pets / cap / eviction / grandfather** — still the Chapter 09 product
words: per-origin session-keyed panels, max concurrent sessions, optional
eviction of lower-ranked incumbents, activation gate so enabling session pets
does not spawn a zombie wall.

---

## `ActivityState` — the closed work vocabulary

What the pet is **doing** this second. Closed enum; wire strings are
`snake_case`; unknown → `.idle` at decode. Exhaustive `switch` in renderers —
no `default:`.

Buckets (not separate types — just how humans cluster them):

| Bucket | Examples |
| --- | --- |
| Floor | `idle`, `revive`, `standby`, `errored`, `waiting_for_input` |
| Heuristic work | `implementing`, `editing`, `thinking`, `reading`, `testing`, … |
| SoA / gate | `ticket_started`, `red_tdd`, `green_tdd`, `adversarial_review`, … |

Canonical contract (schema **v10** as of Phase 20 / v3): 
[`animation-state-vocabulary.md`](https://github.com/cesarnml/codogotchi/blob/main/docs/contracts/animation-state-vocabulary.md).
Pedagogy: [Chapter 02](/02-the-data-contract/).

---

## Sticky slice stamps (schema v10)

Optional ISO-8601 fields on each slice — durable clocks, not in-memory
stopwatches:

| Field | Role |
| --- | --- |
| `prompt_started_at` | current prompt/turn began |
| `session_started_at` | slice birth ("Started …" in Sessions) |
| `errored_since` | lasting error clock |
| `turn_ended_at` | frozen/ended turn |

Hooks **set / clear / preserve** on lifecycle edges; mid-turn tool ticks
preserve. PromptTimer hydrates from disk. File catalog:
[Chapter 17](/17-disk-contract/).

---

## User-facing actions (same words in UI and code)

| Word | Means |
| --- | --- |
| **Force Idle** | write the slice idle (narrow app write-back); does not resurrect aged-out pets |
| **Hide** | conceal window; key stays in hidden set / may keep cap seat |
| **Show** | re-spawn a concealed/live session; may refresh `updated_at` |
| **Prune** | delete the visible session's slice (fold → winner's slice) |
| **Rename** | override label in `session-labels.json` (manual beats live title) |
| **Mode switch** | own ↔ minimalist (etc.) via `CustomizationStore` |

**Hidden ≠ dismissed.** Hide is user intent; TTL dismiss is idle-expiry. Both
can leave a key "concealed" for lifecycle purposes, but they are different
verbs.

---

## Customization and stores

| Name | Role |
| --- | --- |
| **`CustomizationStore`** | single read-merge-write + change publication for `customization.json` |
| **`AppStateStore`** | frames, hidden keys, onboarding — `app-state.json` |
| **`SessionLabelStore`** | renames — `session-labels.json` |

Settings view models are **adapters** over stores, not competing writers.
Pool still re-reads customization each tick.

---

## Say this / not that

| Prefer | Avoid / clarify |
| --- | --- |
| "This `WindowKey.session`…" | "This string key…" (unless at a parse/serialize boundary) |
| "Lifecycle is Archived" | "It's idle" (unless you mean `ActivityState.idle`) |
| "Derive decided DesiredWindows" | "`update()` mutated the pool" (legacy v2 phrasing) |
| "Fold winner session" | "The combined window's session" without naming the winner |
| "Drawer: Pool/" | "Somewhere in Sources/" |
| "Slice stamp `prompt_started_at`" | "The in-memory prompt timer" as source of truth |

---

## Where to go next

| Need | Chapter |
| --- | --- |
| How v3 landed these names | [13 — v3 As Built](/13-v3-as-built/) |
| Pre-enum key ladder & pool product rules | [09 — v2 As Built](/09-v2-as-built/) |
| Why the types existed | [10 — The Seams](/10-the-seams-v3-redesign/) |
| Every file under `~/.codogotchi/` | [17 — Disk Contract](/17-disk-contract/) |
| Activity-state pedagogy | [02 — The Data Contract](/02-the-data-contract/) |

🗣️ **In plain English.** v3.0.0's domain language is small on purpose: slices,
origins, sessions, three key kinds, four lifecycle ages, four window modes,
three pool verbs, and a closed activity vocabulary. Use those nouns and the
codebase stops sounding like five different apps.
