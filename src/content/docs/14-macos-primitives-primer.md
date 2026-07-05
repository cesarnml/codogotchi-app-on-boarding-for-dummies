---
title: "14 — macOS Primitives Primer"
---

> Goal: a reference for the Apple platform primitives codogotchi leans on —
> `LSUIElement`, `NSStatusItem`, `NSPanel`, SpriteKit, and friends. For each:
> what it *is* (jargon + plain), the web/TS analogy, **where codogotchi uses it**
> (real `file:line`), and the gotcha that bites. Chapter 05 covered the *language*;
> this covers the *platform*.
>
> Read it once for the lay of the land, then keep it open as a lookup. You don't
> need to memorize APIs — you need to know "which thing does what, and where ours
> lives."

---

## First: the framework map (which umbrella is what)

Apple ships layered frameworks. When you `import X`, you're pulling in one of
these. Knowing the umbrella tells you what kind of thing you're dealing with:

| `import` | Layer | What lives there | codogotchi uses it for |
|---|---|---|---|
| **Foundation** | core, no UI | `Codable`, `Timer`, `NotificationCenter`, `URL`, `Date`, `ProcessInfo`, `Bundle` | JSON, the poll loop, dates, env, resources |
| **AppKit** | macOS UI | `NSApplication`, `NSStatusItem`, `NSPanel`, `NSView`, `NSImage`, `NSMenu` | the menu-bar item, windows, menus, drawing |
| **SpriteKit** | 2D animation/game | `SKView`, `SKScene`, `SKSpriteNode`, `SKTexture`, `SKAction` | the animated floating pet |
| **Core Graphics** (CoreGraphics / Quartz) | low-level 2D | `CGImage`, `CGRect`, `CGContext`, `CGColor` | spritesheet slicing, geometry |
| **Core Image** | image filters | `CIImage`, `CIFilter`, `CIContext` | grayscale "failure" desaturation |

🇹🇸 **TS analogy.** Foundation ≈ the Node/JS standard lib (no DOM). AppKit ≈ the
DOM + window APIs. SpriteKit ≈ a `<canvas>` game engine. Core Graphics ≈ the 2D
canvas drawing context. Core Image ≈ a CSS-filter/WebGL-shader layer for bitmaps.

> **AppKit vs SwiftUI:** this app is **AppKit** (the older, imperative macOS UI
> framework), *not* SwiftUI. When you search for help, add "AppKit"/"NSView" or
> you'll get SwiftUI answers that don't apply. (Repeated from Ch.08 because it
> trips everyone.)

---

## The app-shell layer — "no Dock icon, just a menu-bar thing"

### `LSUIElement`
**What:** an `Info.plist` boolean. `true` = this app is a UI **agent**: no Dock
icon, no app-switcher entry, no main window or menu bar of its own.
**Plain:** "Run me as a background-ish menu-bar utility, not a normal windowed
app." **Ours:** `Sources/Info.plist` → `<key>LSUIElement</key><true/>`.
🇹🇸 Like an Electron app that only creates a `Tray`, never a `BrowserWindow`.

### `NSApplication` + `NSApplicationDelegate` + `@main`
**What:** `NSApplication` is the running app object (one per process).
`NSApplicationDelegate` is the protocol whose callbacks (`applicationDidFinish‑
Launching`, `…WillTerminate`) are your lifecycle hooks. `@main` marks the type
whose `main()` boots the process.
**Plain:** the entry point and lifecycle callbacks — your `index.ts` + app
`onReady`/`onQuit`. **Ours:** [`MenubarApp.swift:12`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/MenubarApp.swift#L12)
(`@main final class MenubarApp: NSObject, NSApplicationDelegate`); the giant
`applicationDidFinishLaunching` ([:102](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/MenubarApp.swift#L102))
is the **composition root** where everything is wired.
🇹🇸 `applicationDidFinishLaunching` ≈ your app's bootstrap/`main()`; `application‑
WillTerminate` ≈ a global cleanup/`beforeExit`.

### `setActivationPolicy(.accessory)`
**What:** the runtime twin of `LSUIElement` — sets the app as an accessory
(menu-bar) app at launch. **Ours:** [`MenubarApp.swift:98`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/MenubarApp.swift#L98).
⚠️ **Gotcha:** belt-and-suspenders with `LSUIElement`. Both exist so the app
behaves agent-like whether launched from Finder or run directly from the binary.

### `NSStatusItem`
**What:** your slot in the system menu bar (top-right). It has a `.button` whose
`.image` you set and `.toolTip` you set; assign it a `.menu` for the dropdown.
**Plain:** the little icon up top that *is* the menu-bar pet.
**Ours:** created at [`MenubarApp.swift:103`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/MenubarApp.swift#L103);
the pet image is pushed into `item.button?.image` by `MenubarRenderer`'s sink
([:167](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/MenubarApp.swift#L167)); the failure tooltip is
`item.button?.toolTip` ([:295](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/MenubarApp.swift#L295)).
🇹🇸 ≈ Electron `Tray` — `setImage`, `setToolTip`, `setContextMenu`.
⚠️ **Gotcha:** the status item is `var statusItem` held strongly on the delegate
([:15](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/MenubarApp.swift#L15)) — drop the reference and
ARC frees it and the icon vanishes (Ch.05 §6).

### `NSMenu` + `NSMenuItem`
**What:** the dropdown and its rows. Each item has a `title`, an `action`
(`#selector(...)`), a `target` (who handles it), and an optional `keyEquivalent`.
**Ours:** [`MenubarMenu.swift:47`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/MenubarMenu.swift#L47)
builds Show/Hide Floating Pet, Settings (`,`), Quit (`q`).
⚠️ **Gotcha (documented in the file):** `NSMenuItem.target` is a **weak**
reference, so the object holding the actions (`MenubarMenu`) must be retained by
someone (`var menuBuilder` on the delegate, [:62](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/MenubarApp.swift#L62))
or the items appear but their clicks silently no-op.
🇹🇸 `#selector(foo)` ≈ naming a callback by reference; `target` ≈ `this` binding.

---

## The windowing layer — the floating pet's home

### `NSWindow` / `NSPanel`
**What:** `NSWindow` is a window; `NSPanel` is a lightweight window subclass for
auxiliary/floating UI. codogotchi builds the floating pet as a heavily-configured
borderless panel. **Ours:** `makePanel` at
[`FloatingPetPanel.swift:645`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/FloatingPetPanel.swift#L645):

```swift
let panel = NSPanel(
    contentRect: frame,
    styleMask: [.borderless, .nonactivatingPanel],  // no titlebar; don't steal focus
    backing: .buffered, defer: false)
panel.backgroundColor = .clear      // transparent…
panel.isOpaque = false              // …so the desktop shows through
panel.hasShadow = false             // no window shadow around the sprite
panel.level = .floating             // stay above normal windows
panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]  // follow you everywhere
```

🧠 **Plain English, line by line:** make a chromeless, see-through, shadowless
window that floats above everything, doesn't grab keyboard focus when you click
it, and appears on every Space (even over full-screen apps). That bundle of
settings is *what makes a desktop pet feel like a desktop pet* rather than a
normal app window. (The same recipe repeats for the badge/HUD sub-panels — that's
the `:759/:1022/:2476` matches.)
🇹🇸 ≈ a frameless, transparent, `alwaysOnTop`, `focusable:false` Electron
`BrowserWindow` with `skipTaskbar` and `visibleOnAllWorkspaces`.

- `.nonactivatingPanel` → clicking the pet doesn't pull your app focus away from
  your editor. Crucial for a pet that overlays your work.
- `level = .floating` → z-order above ordinary windows (there are many levels;
  floating is a standard "above normal" tier).

### `NSView`
**What:** a rectangular region that draws itself and handles events; the building
block of all AppKit UI. You subclass it and override `draw(_:)`/event methods.
**Ours:** the badge/HUD chrome are `NSView` subclasses (e.g. `RPGHeartView`,
`RPGRingView` in `RPGHUDPanel.swift`); `FloatingPetInteractionView` hosts the
SpriteKit view and handles drag/click-hold.
🇹🇸 ≈ a DOM element / a React component that owns its own paint + events.

### `NSScreen`, `CGRect` / `CGPoint` / `CGSize`
**What:** `NSScreen.visibleFrame` is the usable screen area (minus menu bar/Dock).
The `CG*` types are plain geometry value-structs. **Ours:** placement + clamping
in [`AppState.swift`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/AppState.swift)
(`FloatingFramePolicy.clamp`) keeps the pet on-screen; `visibleFloatingFrame()`
([`MenubarApp.swift:581`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/MenubarApp.swift#L581)).
🇹🇸 `CGRect` ≈ `{x, y, width, height}`. ⚠️ **Gotcha:** macOS screen coordinates
are **y-up, origin bottom-left** (unlike the web's y-down top-left) — see the
note in `AppState.swift`'s frame math.

---

## The rendering layer — pixels two ways

### `NSImage` and `CGImage`
**What:** `NSImage` is the high-level AppKit bitmap (what you hand to a status
item or view); `CGImage` is the low-level Core Graphics bitmap you can slice and
filter. **Ours:** `CodexPet`/`CodogotchiPet` load a WebP into an `NSImage`, get
its `CGImage`, then `cgImage.cropping(to:)` each frame rect
([`CodexPet.swift:299`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/CodexPet.swift#L299)).
⚠️ **Gotcha (real bug they fixed):** they carry the `CGImage` alongside the
`NSImage` in a `Frame` struct because asking AppKit to re-vend a `CGImage` from
an `NSImage` intermittently returned nil and caused menu-bar flicker
([`CodexPet.swift:342`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/CodexPet.swift#L342)).
🇹🇸 `NSImage` ≈ `HTMLImageElement`; `CGImage` ≈ `ImageBitmap` you can `drawImage`
sub-rects from.

### Core Image — `CIFilter` / `CIImage` / `CIContext`
**What:** GPU-accelerated image filters. **Ours:** the **desaturation** failure
visual — `CIFilter.colorControls()` with `saturation = 0` turns the pet grayscale
when the data can't be trusted ([`MenubarRenderer.swift:160`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/MenubarRenderer.swift#L160)).
🇹🇸 ≈ applying a CSS `filter: grayscale(1)` / a WebGL shader to a bitmap.

### SpriteKit — `SKView` / `SKScene` / `SKSpriteNode` / `SKTexture` / `SKAction`
**What:** Apple's 2D animation/game framework. The pieces:
- **`SKView`** — the `NSView` that renders a scene (the bridge from AppKit into
  SpriteKit). Ours: `skView` in `FloatingPetInteractionView`
  ([`FloatingPetPanel.swift:1762`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/FloatingPetPanel.swift#L1762)),
  with `allowsTransparency = true` so the pet floats over a clear panel
  ([:1814](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/FloatingPetPanel.swift#L1814)), presented via
  `skView.presentScene(scene)` ([:1832](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/FloatingPetPanel.swift#L1832)).
- **`SKScene`** — the per-frame render/update surface; you subclass it. Ours:
  [`FloatingPetScene.swift:86`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/FloatingPetScene.swift#L86).
- **`SKSpriteNode`** — a node that displays a texture (the pet itself; also the
  glow/sparkle/fly effects). Ours: `spriteNode` ([:97](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/FloatingPetScene.swift#L97)).
- **`SKTexture`** — the image a node draws; built per animation frame from a
  `CGImage` via `SKTexture(cgImage:)` ([:588](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/FloatingPetScene.swift#L588)).
- **`SKAction`** — declarative animations (move/fade/scale/sequence) used for the
  effect overlays.

🧠 **Plain English.** `SKView` is the `<canvas>` element; `SKScene` is your
render-loop controller; `SKSpriteNode` is a sprite you position and give a
picture to; `SKTexture` is that picture; `SKAction` is a tween. codogotchi swaps
the sprite's texture each tick to flip-book the animation, and overlays `SKAction`
effects for level-ups and sickness.
⚠️ **Gotcha:** SpriteKit runs its own render timer. That's why the floating pet
costs more CPU than the static menu bar, and why the app **opts out of App Nap**
only while the pet is visible (next section).
🇹🇸 ≈ a `<canvas>` + game loop; `SKAction` ≈ a tween/`requestAnimationFrame`
animation helper.

---

## The data layer — JSON without boilerplate

### `Codable` + `JSONDecoder` / `JSONEncoder`
**What:** conform a type to `Codable` and the compiler generates JSON encode/
decode matching its fields. `keyDecodingStrategy = .convertFromSnakeCase` maps
`activity_state` → `activityState`. **Ours:** `StatePayload`/`StateSnapshot`
decode in [`StateJsonReader.swift`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/StateJsonReader.swift);
`FloatingAppState` round-trips `app-state.json` in
[`AppState.swift`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/AppState.swift). `ActivityState`
overrides `init(from:)` for the unknown→idle fallback (Ch.02).
🇹🇸 ≈ `zod` parsing **auto-derived** from your `type` — but you can hand-write
`init(from:)` when you need custom logic. `JSONDecoder` ≈ `JSON.parse` + schema.

---

## The runtime / system-integration layer

### `Timer`
**What:** scheduled repeating/one-shot callback on a run loop. **Ours:** the 1 Hz
poll in `LivePollingDriver.start()` ([:166](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/LivePollingDriver.swift#L166));
the SpriteKit frame timer in `FloatingPetScene`; the 30 s hook-status refresh and
0.5 s `hud-pin` watcher in `MenubarApp`.
🇹🇸 ≈ `setInterval`/`setTimeout`. ⚠️ pauses while the Mac sleeps (that's why only
a *wake* handler is needed, not a sleep one — Ch.03).

### `NotificationCenter` (+ `NSWorkspace`)
**What:** an in-process pub/sub event bus. `NSWorkspace.notificationCenter`
carries system events (sleep/wake). **Ours:** the screen-layout-changed observer
that re-clamps the pet ([`FloatingPetController.swift:66`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/FloatingPetController.swift#L66));
the **wake-from-sleep** observer that triggers an immediate poll
([`MenubarApp.swift:397`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/MenubarApp.swift#L397)).
🇹🇸 ≈ `EventEmitter` / `window.addEventListener`. ⚠️ **Gotcha:** you must
`removeObserver` on teardown ([`MenubarApp.swift:479`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/MenubarApp.swift#L479),
`FloatingPetController.deinit`) or you leak / call into dead objects.

### `ProcessInfo` — env vars **and** App Nap opt-out
**What:** `ProcessInfo.processInfo.environment` reads env vars (all the
`CODOGOTCHI_*` knobs, Ch.02/13). `beginActivity(options:reason:)` tells macOS
"don't throttle me" (opt out of **App Nap**, the power-saver that slows
background apps). **Ours:** env reads throughout; the App-Nap opt-out is held
**only while the floating pet is visible** so menu-bar-only mode stays cheap
([`MenubarApp.swift:425`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/MenubarApp.swift#L425)).
🇹🇸 env ≈ `process.env`. App Nap has no clean web analog — closest is "don't let
the OS throttle my `requestAnimationFrame` when I'm not focused."
⚠️ **Gotcha:** the returned activity token is held in `var activity` and ended in
`applicationWillTerminate`; forget to end it and you keep the machine from
napping forever.

### `DispatchWorkItem`
**What:** a cancelable block scheduled on a queue. **Ours:** the HUD's
auto-hide-after-4s timer (`hudAutoHideWork` in `FloatingPetPanel.swift`) — a fresh
hover cancels the pending hide and reschedules.
🇹🇸 ≈ a `setTimeout` whose handle you keep so you can `clearTimeout` it.

### `Bundle`
**What:** the app package (`.app`) and its bundled resources. **Ours:**
`Bundle.main.resourceURL` locates the seeded Maew pet and demo fixtures
([`MenubarApp.swift:514`/`:527`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/MenubarApp.swift#L514)).
🇹🇸 ≈ your packaged `public/` assets resolved at runtime.

### `@MainActor` + `Task`
**What:** `@MainActor` pins code to the UI thread (compile-checked); `Task {
@MainActor in … }` hops work onto it from a callback. **Ours:** all the
controllers/drivers are `@MainActor`; timer callbacks wrap their work in `Task {
@MainActor in … }` ([`MenubarApp.swift:385`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/MenubarApp.swift#L385)).
🇹🇸 JS is single-threaded so you rarely think about this; treat it as "this must
run on the UI thread" and leave the annotations alone (Ch.05 §7).

---

## One-screen recap

```
LSUIElement / .accessory ── be a menu-bar agent (no Dock)
  NSApplication/@main ───── process + lifecycle (composition root)
    NSStatusItem ────────── the menu-bar icon (+ tooltip, + NSMenu dropdown)
    NSPanel (borderless, ── the floating pet window: transparent, on-top,
      clear, .floating,      non-activating, all-Spaces
      non-activating)
      └ SKView → SKScene ── SpriteKit render loop
          └ SKSpriteNode ── the sprite, textured per frame from
              ← SKTexture ←   CGImage slices of the spritesheet
  NSImage/CGImage ───────── load + slice spritesheets
  CIFilter ──────────────── grayscale "failure" look
  Codable/JSONDecoder ───── parse state.json / app-state.json
  Timer ─────────────────── 1 Hz poll + frame ticks
  NotificationCenter ────── wake-from-sleep, screen-change
  ProcessInfo ───────────── env knobs + App Nap opt-out (float only)
  Bundle ────────────────── seeded pet + demo fixtures
```

## 🧪 Prove it to yourself

1. **Find the pet-window recipe.** Open `makePanel`
   ([`FloatingPetPanel.swift:645`](https://github.com/cesarnml/codogotchi/blob/main/apps/menubar/Sources/FloatingPetPanel.swift#L645)).
   For each of the six settings (`borderless`, `nonactivatingPanel`, clear bg,
   not opaque, no shadow, `.floating`, all-Spaces), say in one phrase what would
   break if you removed it. (e.g. drop `.nonactivatingPanel` → clicking the pet
   steals focus from your editor.)

2. **Trace one frame's path through the stack.** A spritesheet row → `CGImage`
   slice (`CodexPet`) → `SKTexture(cgImage:)` (`FloatingPetScene:588`) →
   `spriteNode.texture` → drawn by `SKView`. Name the framework at each hop
   (Core Graphics → SpriteKit → SpriteKit → SpriteKit/AppKit bridge).

3. **Connect App Nap to CPU.** Why does `beginActivity` get called only while the
   float is visible, and ended when hidden? (SpriteKit's render timer is the cost;
   menu-bar-only mode has no animation to protect, so let macOS nap it.)

➡️ Back to the [README / index](./README.md).
