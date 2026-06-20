---
title: "08 — Swift Learning Resources"
---

> Goal: "enough to be dangerous but prudent." You're a practical TS/FP dev — you
> don't need the whole language landscape, you need the slice that makes *this
> app* legible and lets you build v2. Resources are **tiered by urgency** and
> tagged with *why it matters here*. Skip anything marked "later."
>
> ⚠️ Links rot and my training has a cutoff — treat exact URLs as starting points
> and prefer the **search queries** I give over a stale link. The publishers
> (Apple, Paul Hudson, Kodeco, Big Nerd Ranch) are stable; specific page paths
> may move.

---

## How to use this page

Don't read top to bottom. Match your need to the tier:

- **Tier 0 — Right now** if Swift *syntax* is the blocker. ~2–4 hours total.
- **Tier 1 — This week** to make the architecture chapters click. Reference, not cover-to-cover.
- **Tier 2 — When you hit it** — AppKit / SpriteKit / Codable, looked up on demand.
- **Tier 3 — Later / optional** — depth you don't need to ship v2.

The single highest-leverage move: **Tier 0 + keep [Chapter 05](./05-swift-and-appkit-for-ts-devs.md) open as your cheat-sheet.** Most of what stops a TS dev cold is five idioms (optionals, enums-with-payloads, value vs reference, `weak self`, protocols), all of which 05 already maps.

---

## Tier 0 — Right now (syntax fluency)

**1. The Swift Programming Language (official book) — the relevant chapters only.**
Free, the canonical reference. Read just these, in order:
- *The Basics* (optionals, `let`/`var`, type inference)
- *Enumerations* ← **most important for codogotchi**; associated values + raw values
- *Structures and Classes* ← value vs reference, the bite from Ch.05
- *Optional Chaining* and *Error Handling* (`Result`, `throws`, `guard`)
- *Closures* (capture lists / `[weak self]`)
- *Protocols* (skim)

🔎 Search: `Swift Programming Language book enumerations` and
`swift.org documentation the-swift-programming-language`. It's also in Apple's
free **Swift Playgrounds**/Books app as "The Swift Programming Language."

*Why here:* the app is enums + structs + protocols + closures. These six chapters
cover ~90% of what you'll read daily. Skip generics-deep, actors-deep, operators.

**2. Hacking with Swift — "Learn Swift" free intro (Paul Hudson).**
The fastest practical on-ramp; short, example-driven, TS-dev-friendly tone.
🔎 Search: `Hacking with Swift learn swift` / `hackingwithswift.com/quick-start`.
*Why here:* if the official book feels dry, do this instead/first. Same material,
faster.

**3. Swift for TypeScript/JavaScript developers — a comparison article.**
🔎 Search: `Swift for JavaScript developers` or `Swift vs TypeScript syntax
comparison`. Pick any recent one; you mostly need the optionals ↔ `?.`/`??`,
struct ↔ object, protocol ↔ interface mappings — which Ch.05 already gives you,
so this is optional reinforcement.

---

## Tier 1 — This week (idioms & the "Swifty" mindset)

**4. NSHipster (nshipster.com).** Short, deep articles on specific Swift/Cocoa
topics. Read on demand when a keyword puzzles you.
🔎 Useful entries: `NSHipster Codable`, `NSHipster Never`, `NSHipster
@MainActor` / `Swift concurrency`.
*Why here:* you'll meet `Codable`, `@MainActor`, `NotificationCenter` in the app;
NSHipster explains the *why* better than reference docs.

**5. Swift by Sundell (swiftbysundell.com) — articles + "Basics" series.**
🔎 Search: `Swift by Sundell value types`, `Swift by Sundell dependency
injection`, `Swift by Sundell unit testing`.
*Why here:* this codebase's style — value types for data, function/protocol
injection, test seams — is exactly what Sundell evangelizes. Reading him will
make the app's choices feel *intentional* rather than arbitrary.

**6. ARC / memory management — one solid read.**
🔎 Search: `Swift automatic reference counting retain cycle weak self`.
Apple's *Automatic Reference Counting* chapter is the source of truth.
*Why here:* the `[weak self]` boilerplate everywhere (Ch.05 §6). Understand it
once and you can stop thinking about it.

---

## Tier 2 — When you hit it (frameworks, on demand)

**7. AppKit / menu-bar agents.** AppKit (the macOS UI framework) is older and
less documented than SwiftUI — most tutorials online are SwiftUI, which this app
does **not** use. So:
- 🔎 Search: `macOS NSStatusItem menu bar app tutorial`, `LSUIElement agent app`,
  `NSPanel nonactivating floating window`.
- Apple Developer docs for `NSStatusItem`, `NSPanel`, `NSView` are the reference.
- *Why here:* the menu-bar item, the floating window, and the dropdown menu are
  all AppKit. You'll look these up when editing `FloatingPetPanel` /
  `SettingsWindowController`.
- ⚠️ When googling, **add "AppKit" or "NSView" / "macOS"** to filter out SwiftUI
  answers, which won't apply.

**8. SpriteKit basics.** Only needed when you touch `FloatingPetScene`.
- 🔎 Search: `SpriteKit SKScene tutorial`, `SpriteKit SKTexture animation frames`,
  `Kodeco SpriteKit getting started`.
- Kodeco (formerly raywenderlich.com) has the best SpriteKit material.
- *Why here:* the floating pet's animation loop is SpriteKit. You need: scenes,
  nodes, textures, the `update`/render loop. You do **not** need physics, particles
  beyond what's used, or game architecture.

**9. Codable deep-dive.** When you change `state.json` parsing (i.e. **v2**).
- 🔎 Search: `Swift Codable custom decoding init(from:)`, `Codable keyDecodingStrategy
  convertFromSnakeCase`, `Swift Codable optional vs nullable double optional`.
- *Why here:* the v2 schema change is mostly a `Codable` change. The double-optional
  (`String??`) trick in `StateJsonReader` will make sense after this.

**10. XCTest.** When you write tests (Challenges 3–4).
- 🔎 Search: `XCTest tutorial XCTAssertEqual`, `Swift unit testing dependency
  injection clock`.
- *Why here:* `bun run mac:test` runs XCTest. You already grok testing; you just
  need the assertion API and the setup/teardown shape.

---

## Tier 3 — Later / optional (don't let these block you)

- **Books, if you want one cover-to-cover reference:**
  - *Swift Programming: The Big Nerd Ranch Guide* — methodical, beginner-friendly,
    great for value/reference and protocols. 🔎 `Big Nerd Ranch Swift Programming`.
  - *Cocoa Programming for OS X / macOS by Tutorials (Kodeco)* — the AppKit book;
    dated but still the best structured AppKit intro. 🔎 `Kodeco macOS by tutorials`.
- **WWDC sessions** (Apple's conference talks, on developer.apple.com / YouTube) —
  excellent but deep; watch *targeted* ones only. 🔎 `WWDC Swift concurrency
  explained`, `WWDC value and reference types` (the classic "Building Better Apps
  with Value Types" talk is genuinely worth it for your FP brain).
- **Swift concurrency (async/await, actors)** — the app uses `@MainActor` and
  `Task { }` lightly; you do **not** need the full concurrency model to ship v2.
  Learn it when something forces you to. 🔎 `Swift concurrency async await actors`.
- **SwiftUI** — *skip entirely for now.* This app is AppKit. Learning SwiftUI
  won't help you read it and may confuse (different mental model). Revisit only if
  a future surface is built in SwiftUI.

---

## A pragmatic 1-week plan

If you want a concrete schedule rather than a menu:

| Day | Do | Outcome |
|---|---|---|
| 1 | Tier 0 #1 (the 6 chapters) **or** #2 (Hacking with Swift intro) | read any file's syntax without stalling |
| 2 | Re-read onboarding [Ch.02](./02-the-data-contract.md)+[03](./03-the-polling-loop.md) with new syntax fluency; do [Challenges](./07-challenges.md) 1–2 | the contract + loop click |
| 3 | Tier 1 #5 (Sundell: value types, DI, testing); do Challenge 4 (TDD) | the *style* feels intentional |
| 4 | Tier 2 #7 (AppKit menu-bar) skim; read [Ch.04](./04-the-renderers.md); do Challenge 3 | renderers + the v2-key file |
| 5 | Tier 2 #9 (Codable) + Tier 1 #6 (ARC); do Challenge 6 (new state end-to-end) | you can change the contract safely |
| weekend | [Ch.06](./06-v2-per-platform-multipet.md) + Challenge 7 (v2 routing sketch) | you can scope v2 |

After this you're "dangerous but prudent": fluent enough to read and change the
app, aware enough to respect the lockstep/ARC/value-type traps.

---

## What to deliberately *not* learn yet

Being practical means saying no. For shipping v2 you can safely defer: SwiftUI,
deep generics, custom operators, property wrappers (beyond reading `@MainActor`),
Combine, the full actor/concurrency model, Metal/Core Animation internals, and
package/dependency tooling beyond `xcodebuild`. If one becomes necessary, the app
will tell you by making you reach for it — learn it *then*, in context.

➡️ Back to the [README / index](./README.md).
