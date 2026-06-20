---
title: "05 — Swift & AppKit for TS/FP Devs"
---

> Goal: a translation layer. Every Swift/AppKit idiom you'll hit in this app,
> mapped to TypeScript / FP concepts you already own. Read it once end-to-end,
> then keep it open as a reference while reading source. Examples are drawn from
> this codebase, not toy code.

Use this as a lookup table, not a tutorial. Grouped by how often you'll trip on
each.

---

## 1. `enum` is a real algebraic data type

The single most important mental shift. Swift `enum` is **not** the C/TS numeric
enum — it's a proper **sum type** (discriminated union), often with attached
methods.

```swift
// Simple — like a string union, but a real type:
enum VisualMode: Equatable { case normal; case desaturated }

// With raw values (string-backed) — the wire contract:
enum ActivityState: String { case idle = "idle"; /* … */ }

// With ASSOCIATED VALUES — a tagged union carrying payloads:
enum StateReadError: Error, Equatable {
    case fileNotFound
    case schemaNewer(got: Int, expected: Int)   // carries data
}
```

🇹🇸 **Maps to:**
```ts
type VisualMode = "normal" | "desaturated"
type StateReadError =
  | { tag: "fileNotFound" }
  | { tag: "schemaNewer"; got: number; expected: number }
```

**Exhaustive `switch` with no `default`** is the payoff: the compiler forces you
to handle every case (your `never`-check, automatic). You'll see this everywhere
— e.g. the loop's `decide` switches over `Result` cases exhaustively. When you
add an enum case, the compiler walks you to every switch that needs updating.
*This is a feature you'll rely on heavily in v2's schema work.*

`Result<Success, Failure>` is itself just a built-in enum:
```swift
enum Result<Success, Failure: Error> { case success(Success); case failure(Failure) }
```
🇹🇸 It's `Either<Failure, Success>` / your `{ ok: true, value } | { ok: false, error }`.

---

## 2. `Optional` is `T | undefined`, but enforced

`String?` means "a String **or** nothing." It's literally `enum Optional<T> {
case none; case some(T) }` with sugar. You **cannot** use the value without
unwrapping — the compiler won't let you pretend it's there.

```swift
let origin: String? = snapshot.sourceEvent?.origin   // optional chaining, like TS ?.

if let origin = origin { use(origin) }               // unwrap if present
guard let origin = origin else { return }            // unwrap-or-bail (early return)
let safe = origin ?? "manual"                         // default, like TS ??
```

🇹🇸 You already know `?.` and `??` — same meaning. The new one is `guard let …
else { return }`: an **early-return unwrap**. Read it as "I need this to exist;
if it doesn't, leave now." It keeps the happy path un-nested below.

⚠️ **Double optional `String??`** appears in `StateJsonReader` (`lastActivityAt:
String??`). That distinguishes *"key absent"* (outer `.none`) from *"key present
but JSON null"* (`.some(.none)`). It collapses to a single `nil` at the snapshot
boundary. Don't panic when you see `?? nil` — it's coercing `String??` → `String?`.

---

## 3. `struct` vs `class` — value vs reference (this one bites)

| | `struct` (value type) | `class` (reference type) |
|---|---|---|
| Copied on assignment/pass | **yes** — independent copy | no — shared reference |
| Identity | none (compared by value) | has identity (`===`) |
| In this app | data: `StateSnapshot`, `Outcome`, `RowSpec`, `FloatingAppState` | behavior/lifecycle: every `…Controller`, `…Panel`, `…Driver`, `…Renderer` |

```swift
struct StateSnapshot { let activityState: ActivityState; /* … */ }  // immutable record
final class LivePollingDriver { /* holds mutable state, has identity */ }
```

🇹🇸 **TS analogy.** A `struct` behaves like an immutable plain object you always
spread-copy (`{...obj}`); pass it around freely, nobody can mutate your copy. A
`class` behaves like a TS class instance — shared by reference, has identity.

**The rule of thumb this codebase follows (and you should too):** *data* is a
`struct` (value, immutable, `let` fields); *things with a lifecycle and
mutable internal state* are a `final class`. `final` = "not subclassable" — the
default choice here; inheritance is barely used. 🇹🇸 Think `final class` ≈ a
regular TS class you don't intend anyone to `extends`.

⚠️ **The bite:** if you pass a `struct` into a function and mutate it, you're
mutating a *copy* — the caller's value is unchanged. Coming from JS objects
(always by reference) this is the opposite default. Most structs here are `let`
anyway, so it rarely surprises, but know it.

---

## 4. `protocol` — interfaces, used for testing seams

A `protocol` is an interface. The app uses them mainly to **inject test doubles**.

```swift
@MainActor
protocol FloatingPetPanelManaging: AnyObject {
    func show(frame: CGRect)
    func apply(state: ActivityState, visualMode: VisualMode)
    // …
}
```

`FloatingPetController` depends on `FloatingPetPanelManaging` (the protocol), not
the concrete `FloatingPetPanelController` — so a test can pass a fake panel and
assert it received the right calls.

🇹🇸 **TS analogy.** An `interface`, and the pattern is classic dependency
inversion: depend on the interface, inject the implementation. You do this with
constructor-injected interfaces in TS already.

**`extension ProtocolName { … }`** providing method bodies = **default
implementations** (like a default method on a TS interface via a mixin). You'll
see `extension FloatingPetPanelManaging` give empty default bodies so conformers
only override what they care about.

`AnyObject` constraint = "only classes can conform" (needed for `weak`
references; see below).

---

## 5. Closures + `typealias` — functions as values & dependency injection

This codebase injects **functions**, not just objects. A `typealias` names a
function type.

```swift
typealias Apply = (ActivityState, VisualMode) -> Void   // = type Apply = (s, m) => void
typealias Reader = (String) -> Result<StateSnapshot, StateReadError>

init(reader: @escaping Reader = StateJsonReader.read(at:), …) { … }
```

🧠 **Plain English.** `LivePollingDriver` doesn't hardcode "read from disk" — it
takes a *function* that returns a `Result`. Production passes the real reader;
tests pass `{ _ in .success(fakeSnapshot) }`. Pure functional DI — exactly your
instinct.

- `@escaping` = "this closure is stored and called later" (outlives the call).
  🇹🇸 Just means the callback is retained, not called synchronously. You don't
  need to think hard about it beyond "stored callbacks are `@escaping`."
- `{ [weak self] in … }` capture lists — see memory section below.
- Default parameter values (`= StateJsonReader.read(at:)`) — like TS default args.

---

## 6. Memory: `weak self`, retain cycles (the AppKit tax)

Swift uses **ARC** (automatic reference counting), not a tracing GC. Two objects
that strongly reference each other never get freed — a **retain cycle** (leak).
The fix peppered throughout this app:

```swift
panel.setFrameChangeHandler { [weak self] frame in
    self?.persistFrameChange(frame)
}
```

🧠 **Plain English.** "Inside this stored callback, don't keep `self` alive; if
`self` is already gone, do nothing (`self?.`)." Without `[weak self]`, the panel
holds the closure, the closure holds the controller, the controller holds the
panel → cycle → leak.

🇹🇸 **TS analogy.** You almost never think about this in JS because the GC
handles cycles. Here it's manual. **Rule of thumb when reading:** `[weak self]`
in a stored closure is just leak-avoidance boilerplate — mentally skip it; it
doesn't change the logic. When *writing* a stored callback that captures `self`,
add `[weak self]` by default.

Related: the many `var someController: X?` properties held on `MenubarApp`
"strongly so it is not deallocated" — ARC frees anything not strongly held, so
the app explicitly *keeps* long-lived objects alive by storing them. 🇹🇸 In JS
you'd just have a module-level variable; here holding the reference is what keeps
it from being collected.

---

## 7. `@MainActor` — the UI thread, enforced by the compiler

```swift
@MainActor final class LivePollingDriver { … }
```

`@MainActor` = "all of this must run on the main (UI) thread," checked at compile
time. AppKit UI must be touched on the main thread; this annotation makes that a
type error to violate rather than a runtime crash.

🇹🇸 **TS analogy.** JS is single-threaded so you never think about this. Closest
parallel: imagine the compiler enforcing "this code only runs inside the
browser's main event loop, never in a Worker." You'll see `Task { @MainActor in
… }` to hop back onto the main actor from a timer callback — that's "schedule
this work on the UI thread."

Mostly you just leave these annotations alone. Know that they're why you don't
see manual `DispatchQueue.main.async` everywhere.

---

## 8. Naming & syntax quick-hits

- **Argument labels:** `frames(for state: ActivityState)` is *called*
  `frames(for: .idle)`. The `for` is an external label, `state` the internal
  name. 🇹🇸 Like named params, but positional and part of the method's identity.
  `read(at:)` and `apply(state:visualMode:)` are full method *names*.
- **`let` vs `var`** = `const` vs `let`. `let` is immutable; prefer it (the code
  does).
- **`static`** members = class-level, like TS `static`. `static let production =
  …` is a shared constant.
- **No `;`**, no parens around `if`/`switch` conditions.
- **Trailing closure:** `Timer.scheduledTimer(…) { … }` — the last closure arg
  moves outside the parens. 🇹🇸 Cosmetic; like passing an arrow fn as the last arg.
- **`guard … else { return }`** — covered above; the dominant control-flow idiom.
  Read it as an assertion that bails.
- **`MARK: -`** comments are just section headers (the editor shows them in the
  jump bar). Navigational, ignore.

---

## 9. AppKit nouns you'll meet

| Type | What it is | TS/web analogy |
|---|---|---|
| `NSStatusItem` | the menu-bar icon slot | a system tray item |
| `NSPanel` / `NSWindow` | a floating window | a borderless always-on-top `BrowserWindow` |
| `NSView` | a rectangle that draws itself | a DOM element / React component |
| `NSImage` / `CGImage` | a bitmap (high-level / low-level) | `HTMLImageElement` / `ImageBitmap` |
| `SKScene` (SpriteKit) | a 2D animation/game surface | `<canvas>` + rAF loop |
| `Timer` | repeating/one-shot callback | `setInterval` / `setTimeout` |
| `NotificationCenter` | app-wide pub/sub event bus | an `EventEmitter` / `window.addEventListener` |
| `Codable` | auto JSON encode/decode from a type's shape | `zod` infer + `JSON.parse`, but compiler-generated |
| `Bundle` | the app package; source of bundled assets | your `public/` / packaged resources |
| `CGRect` / `CGPoint` / `CGSize` | geometry value structs | `{x,y,w,h}` plain objects |

**`Codable`** deserves a note: conforming a `struct` to `Codable` makes the
compiler generate JSON encode/decode for free, matching field names (with
`keyDecodingStrategy = .convertFromSnakeCase` to map `activity_state` →
`activityState`). 🇹🇸 It's like getting `zod` parsing auto-derived from your
`type` — except you can override `init(from:)` for custom logic (which
`ActivityState` does for the unknown→idle fallback).

---

## 10. Tests

Swift tests (XCTest) live in `apps/menubar/Tests/MenubarTests/`. They look like:

```swift
func testGateElevatesHookState() {
    driver.tickForTesting()                 // run one tick synchronously, no real Timer
    XCTAssertEqual(captured.last?.state, .greenTdd)
}
```
(`tickForTesting()` is real; the exact assertion shape varies per test file.)

🇹🇸 **TS analogy.** `func testX()` ≈ `it("x", …)`; `XCTAssertEqual(a, b)` ≈
`expect(a).toEqual(b)`. The `…ForTesting` / `tickForTesting()` methods you saw are
**deliberate test seams** — public hooks to drive internal logic synchronously
without real timers or AppKit. Run them with `bun run mac:test` (see project
release notes) or `xcodebuild … test`.

---

## How to read an unfamiliar file in this app

A repeatable procedure:

1. **Top doc-comment** (`///`) — this codebase documents *why* heavily. Read it.
2. **Type declarations** — `grep` or skim for `class`/`struct`/`enum`. A "big"
   file is usually several small types; find the one you need.
3. **`init(...)`** — what does it depend on? Injected functions/protocols tell
   you its collaborators.
4. **Public methods** — the surface others call.
5. **Ignore on first pass:** `[weak self]`, `@MainActor`, `MARK:`, `@objc`,
   `deinit` cleanup. They're machinery, not logic.

➡️ Next: [06 — Where v2 is going](./06-v2-per-platform-multipet.md).
