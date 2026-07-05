---
title: "02 — The Data Contract"
---

> Goal: understand `state.json` and the types that decode it. This is the single
> most important chapter for v2, because **v2 changes this contract.**

The contract has two ends:
- **TypeScript** defines and validates it: `packages/contracts/src/state-json.ts`
  (Zod schema) — your home turf, read it first.
- **Swift** decodes it: `ActivityState.swift` + `StateJsonReader.swift`.

They must agree. The agreement is enforced by a **shared version number** and
discipline, not by a compiler. Hold that thought — it's the big gotcha.

---

## The shape of `state.json`

From [`state-json.ts`](https://github.com/cesarnml/codogotchi/blob/archive/v2.5.0/packages/contracts/src/state-json.ts), lightly
abridged:

```ts
{
  schema_version: 6,                 // bumped whenever the shape changes
  activity_state: "implementing",    // the closed vocabulary — see below
  updated_at: "2026-06-20T12:00:00.000Z",
  source_event: {
    origin: "claude_code",           // WHO drove this  ← the v2 key lives here
    kind: "tool_use",
    name: "Edit",
  },
  // v5 RPG fields
  level: 7, level_fraction: 0.42, half_hearts: 6, active_minutes: 13,
  last_activity_at: "2026-06-20T11:59:00.000Z",
  // optional sub-objects
  attention?: { reason_kind, summary, created_at, expires_at },
  revive_until?: "...",              // v6 — 5s celebration window after a heart gain
}
```

🗣️ **In plain English.** One JSON object = "here is everything about the *one* pet
right now: what it's doing, who's driving it, how healthy it is, and any urgent
message for the human."

**The v2-critical detail:** there is exactly **one** `activity_state` and one
`source_event.origin`. The whole file describes a *single aggregate* pet. The
producer overwrites the entire file on every event — if two agents are running,
the last writer wins and clobbers the other. v2's job is to turn this scalar
into a collection keyed by `origin` (the platform). More in Chapter 06.

---

## The closed `ActivityState` enum

[`ActivityState.swift:13`](https://github.com/cesarnml/codogotchi/blob/archive/v2.5.0/apps/menubar/Sources/ActivityState.swift#L13):

```swift
enum ActivityState: String, Equatable, Codable, CaseIterable {
    case idle = "idle"
    case implementing = "implementing"
    case editing = "editing"
    // … ~25 cases total …
    case reviewClean = "review_clean"
}
```

🇹🇸 **TS analogy.** This is a string-literal union with a runtime guarantee:

```ts
type ActivityState = "idle" | "implementing" | "editing" | /* … */ "review_clean"
```

…except Swift makes it a real *type with attached behavior*. Notice the enum has
**methods and computed properties** hanging off it — `displayLabel`,
`isInFlight`. In FP terms, these are pure functions `ActivityState -> String` /
`ActivityState -> Bool` defined as members. There's no class, no inheritance —
just a sum type with functions over it. That should feel familiar and pleasant.

### "Closed" + "unknown → idle" — read this carefully

Two deliberate design choices that look odd until explained:

```swift
init(from decoder: Decoder) throws {
    let raw = try decoder.singleValueContainer().decode(String.self)
    self = ActivityState(rawValue: raw) ?? .idle      // ← unknown string becomes .idle
}
```

1. **Closed**: there is no `case unknown(String)` escape hatch. The enum is a
   fixed, exhaustive list.
2. **Forgiving at the edge**: any string the app doesn't recognize — including a
   *future* state a newer hook emits that this app build hasn't learned to paint
   — decodes to `.idle` instead of throwing.

**Why both?** Because the renderer switches over `ActivityState` *exhaustively*
with no `default:` branch. The compiler then guarantees every state is painted —
you literally cannot forget one (it won't compile). But that exhaustiveness
would be brittle against forward-compatibility (a newer file with a new state)
*unless* unknown strings are folded to a known case at the boundary. So the
decode boundary absorbs the unknown into `.idle`, and the rest of the app enjoys
total, compiler-checked coverage.

🗣️ **In plain English.** The pet knows a fixed list of ~25 moods. If the note
ever contains a mood it's never heard of — say a future version invents one —
it just shrugs and sits idle instead of crashing. Inside the app, though, the
list is treated as complete, so the compiler makes sure every single mood has
artwork and behavior — you *can't* forget one.

🇹🇸 **TS analogy.** It's the difference between:
```ts
switch (s) { case "idle": …; /* forgot a case? TS won't always catch it */ }
```
and an exhaustive switch with a `never` check — but here Swift does the `never`
check *for free* on every `switch`, and the decoder guarantees `s` is always a
known member. The combination is "parse, don't validate" applied to an enum.

⚠️ **Gotcha.** Because unknown → idle, a typo in a hook-emitted string doesn't
error loudly — the pet just silently sits idle. When debugging "pet won't react,"
suspect a state-string mismatch between the TS producer and this enum.

---

## `StateSnapshot` — the decoded file

[`ActivityState.swift:163`](https://github.com/cesarnml/codogotchi/blob/archive/v2.5.0/apps/menubar/Sources/ActivityState.swift#L163)
is the Swift mirror of `state.json`:

```swift
struct StateSnapshot: Equatable {
    let schemaVersion: Int
    let activityState: ActivityState
    let updatedAt: String
    let sourceEvent: SourceEvent?      // origin/kind/name — optional
    let attention: AttentionPayload?
    let level: Int
    let halfHearts: Int
    let lastActivityAt: String?
    let reviveUntil: String?
    // …
}
```

🇹🇸 **TS analogy.** A `struct` here is essentially a `type` + a frozen object.
It's a **value type** (copied on assignment, not shared by reference) — covered
properly in Chapter 05, but the headline: a `StateSnapshot` can't be mutated out
from under you. It's an immutable record, exactly like you'd model it in FP with
`readonly` everywhere.

Note `sourceEvent`, `attention`, `reviveUntil` are **Optionals** (`?`) — the
Swift equivalent of `T | undefined`, but enforced: you cannot use the value
without unwrapping it. Older file versions omit fields, so optionality encodes
"this field may not exist in older payloads."

🗣️ **In plain English.** Once the note is read, it becomes a frozen snapshot —
a photograph, not a live feed. Nothing can quietly change it while the app is
mid-thought, which kills a whole category of bugs before they exist.

---

## Schema versioning & the lockstep gotcha

This is the thing most likely to trip you, and it's load-bearing for v2.

**Two constants must move together:**

| Side | Constant | File |
|---|---|---|
| TypeScript | `STATE_JSON_SCHEMA_VERSION = 6` | `packages/contracts/src/state-json.ts:4` |
| Swift | `EXPECTED_STATE_SCHEMA_VERSION = 6` | `StateJsonReader.swift:8` |

The forward-compat policy ([`StateJsonReader.swift`](https://github.com/cesarnml/codogotchi/blob/archive/v2.5.0/apps/menubar/Sources/StateJsonReader.swift)):

- file `schema_version` **>** what the app expects → **refuse** (return
  `.schemaNewer`, show "update the app" tooltip). The app won't guess at a shape
  it doesn't know.
- file version **≤** expected → parse best-effort, tolerate extra/missing fields
  (newer-but-compatible and older payloads both work).

⚠️ **The lockstep gotcha (this is in the project memory for a reason).** If you
bump the schema on one side only, the pet **grays out**. Bump the TS writer to 7
without bumping Swift, and every Swift read fails `.schemaNewer` → desaturated
idle. Bump Swift to expect 7 without the writer emitting the new field, and you
read garbage/defaults. **A schema change is always a two-file (really
three-file) PR:** the Zod schema, the Swift `EXPECTED_…` constant, and the Swift
`StatePayload`/`StateSnapshot` decode. v2 *is* a schema bump — you will do this
dance.

🇹🇸 **TS analogy.** Imagine your frontend and backend share a DTO but in
different repos with no codegen. You version the DTO and refuse mismatches at
runtime. Same discipline. The version number *is* the type-safety you'd normally
get from a shared package.

🗣️ **In plain English.** The note-writer and the note-reader are written in two
different languages, so no tool can check they agree — instead the note carries
a version number, like "this form is edition 6." If the reader sees an edition
newer than it understands, it refuses politely (gray pet, "update me") rather
than guessing. The classic mistake is updating the edition number on one side
only — the pet grays out and everyone spends an afternoon confused.

---

## How the reader maps errors to visuals

`StateJsonReader.read(at:)` returns a `Result<StateSnapshot, StateReadError>`
(Chapter 05 covers `Result`; for now it's `Either<Error, Success>`). The error
cases are *typed*, and each maps to a specific user-facing visual downstream:

| `StateReadError` | What happened | Pet shows |
|---|---|---|
| `.fileNotFound` | hooks installed, no agent run yet | idle + "waiting for first prompt" |
| `.malformed` / `.schemaMissingOrInvalid` | unparseable / no version | **desaturated** idle + "hook too old" |
| `.schemaNewer(got, expected)` | file from a newer app | desaturated idle + "update the app" |
| `.success(snapshot)` | all good | the real state, full color |

🗣️ **In plain English.** The reader never crashes and never throws past its
boundary. Every failure mode is a named value the loop knows how to paint. This
"errors are data, not exceptions" style is exactly the FP instinct you already
have — the codebase leans on `Result` and typed enums instead of `try/catch`
soup.

---

## Two sibling files the loop also reads

`state.json` is the main feed, but the loop reads two companions from the same
directory:

- **`gate.json`** — written by Son-of-Anton (SoA) delivery tooling. It can
  *elevate* the activity to a high-confidence "gate" state (e.g. `green_tdd`,
  `open_pr`). Logic in `GateJsonReader.swift`. Think of it as a more-trusted
  overlay on top of the heuristic hook state.
- **`delivery-context.json`** — drives the persistent **gate badge** text on the
  floating pet (ticket id, plan key, etc.).

You can ignore both until Chapter 03; just know "state isn't the only file."

🗣️ **In plain English.** Besides the main diary, the reader also checks two
smaller notes: one from the delivery tooling that says "trust me, we're in the
review phase" (which outranks the guess), and one that puts a little ticket
badge on the pet.

---

## 🧪 Prove it to yourself

1. **Match the enum to the union.** Open `ActivityState.swift` and
   `packages/contracts/src/animation-state.ts` side by side. Confirm the Swift
   `case` raw values equal the TS enum members one-for-one. That equality *is*
   the contract.

2. **Trigger the lockstep failure (mentally).** Trace what happens if you set
   `STATE_JSON_SCHEMA_VERSION = 7` in TS and rebuild the hook, but leave Swift
   at 6. Walk it: hook writes `schema_version: 7` → `StateJsonReader` hits the
   `schemaVersion > EXPECTED` branch → `.schemaNewer` → desaturated idle. You've
   just predicted a real bug class.

3. **Find where unknown→idle saves you.** In `ActivityState.swift`, the
   `init(from:)` `?? .idle`. Delete it in your head and ask: what happens when a
   v7 hook emits `"refactoring"` to a v6 app? (Answer: with the fallback, idle;
   without it, a decode throw → `.malformed` → gray pet. The fallback is why a
   *new state* degrades gracefully while a *broken file* degrades loudly.)

➡️ Next: [03 — The polling loop](./03-the-polling-loop.md).
