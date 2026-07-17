# ShowForge Studio

A web-based **3D stage & show simulator** for designing music, light and FX
shows — in the spirit of Depence / Capture / L8, simplified and modernised for
the browser. Build a stage, rig it with lights, lasers, LED walls and pyro,
program a synchronised timeline, import a track and hit **Play** to preview the
whole show in real time.

![ShowForge Studio](docs/preview.png)

> V1 — fully client-side. No backend, no accounts. Projects live in your
> browser's `localStorage` and can be exported / imported as JSON.

---

## Quick start

```bash
npm install      # install dependencies
npm run dev      # start the dev server  →  http://localhost:5173
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build locally
npm run lint     # type-check only (tsc --noEmit)
npm run test     # unit tests (Vitest) — event engine, timeline, collisions…
```

Open the dev URL and you'll land straight in **“Demo Festival Intro”** — a full
rig with a ~90s programmed show. Press **Space** (or the round Play button) and
watch the lights, lasers and FX fire on the timeline, even with no audio loaded.

---

## Tech stack

| Concern        | Choice                                   |
| -------------- | ---------------------------------------- |
| UI             | React 18 + TypeScript + Vite             |
| 3D             | Three.js · @react-three/fiber · drei     |
| Post-processing| @react-three/postprocessing (Bloom)      |
| State          | Zustand                                  |
| Styling        | Tailwind CSS (custom dark theme)         |
| Audio          | Web Audio API (HTMLAudio + AnalyserNode) |
| Persistence    | `localStorage` + JSON export/import      |

---

## Architecture

```
src/
  components/
    layout/      AppShell, TopBar, LoadProjectModal
    library/     ObjectLibrary (left sidebar)
    scene/       SceneViewport, StageScene, SceneObject, LightFixture,
                 LaserFixture, Smoke/Flame/CO2/Confetti effects, LedScreen,
                 static props, particle system, ShowStateContext
    inspector/   InspectorPanel (right sidebar)
    timeline/    TimelinePanel, EventBlock, EventEditor, AudioControls
    ui/          Icon, fields, Modal, Toasts
  store/
    useShowStore.ts   single Zustand store (document + selection + playback)
  types/
    show.ts           Project / SceneObject / ShowEvent models
  utils/
    audio.ts          AudioEngine (play/seek/level/waveform peaks)
    events.ts         event engine → live ShowState snapshot
    project.ts        save / load / export / import / sanitize
    usePlaybackClock  single rAF clock driving currentTime
  data/
    catalog.ts        object catalog + factories + event metadata
    demoProject.ts    the bundled demo show
```

### How the show runs

1. A **single `requestAnimationFrame` clock** (`usePlaybackClock`) advances
   `currentTime` — following the audio element when a track is loaded, or a
   virtual clock otherwise (so the demo plays with no audio).
2. Each frame, `StageScene` calls **`evaluateEvents(events, time)`** which folds
   the timeline into a flat **`ShowState`** (light colors/intensity/strobe/sweep,
   laser state, LED color/pulse, active FX bursts, blackout).
3. That snapshot is shared through a **ref + React context**, so every fixture
   reads it inside its own `useFrame` — the heavy 3D never causes React
   re-renders during playback. UI bits that show time (playhead, clock) subscribe
   to the store directly and stay cheap and isolated.

Lights are **action-scoped**: a fixture is dark unless an action *targeting it*
is currently running. Any light action (colour / intensity / strobe / movement)
cues its targets on for the length of its clip — using the explicit brightness
of an intensity action, or full otherwise — then they go dark again. Actions can
target **specific fixtures** (add an action with lights selected and it targets
just those) or **all** of them. Other window events (bursts / blackout) are
active only for their clip duration; the laser/LED colour still persists.

---

## Two modes: Build & Show

A switch in the top bar flips between the two ways you work on a show:

- **Build mode** — a construction sandbox (the timeline is hidden, work light
  comes on). A bottom **build toolbar** gives you a **grid** (show/hide + cell
  size), **grid snapping**, **magnetic snapping** (objects click flush against
  each other's faces and auto-align their centres, like magnets) and
  **collisions** — each independently toggleable, in the spirit of Planet
  Coaster's building tools. Assemble a clean, believable rig without touching
  the timeline.
- **Show mode** — the timeline / playback programming from V1: tracks, clips,
  audio, transport.

## Features

- **Beginner-friendly** — a welcome guide opens on first run (reopenable via the
  “?” button) explaining the two modes and the three core actions. Selecting an
  object shows on-screen **Move / Rotate / Duplicate / Delete / Deselect**
  buttons, and Build mode shows a step-by-step hint — no shortcuts to memorise.
- **3D viewport** — orbit / zoom / pan, a grey concrete ground to build on, ACES
  tone-mapping and bloom. **Selection & movement are deliberate**: a clean click
  selects (dragging the camera never selects or nudges anything), and an object
  only moves once you press **Move** — then you grab-and-slide it across the floor
  (Shift = raise / lower), or press **Rotate** for the ring gizmo. It drops
  exactly where you release it, and only the selected object ever moves.
- **Sky & daylight** — a gradient sky with a sun that rises and sets: blue day
  with neutral daylight and **real sun shadows** (High quality), dark-blue night
  with **stars, a moon and cool moonlight** so the rig pops. A Sky panel offers
  **Day / Night presets** plus time-of-day and day / night brightness sliders
  (and ground fog). The build grid is an optional overlay, off by default.
- **Living crowd** — instanced people (torsos, heads, varied skin tones and
  clothing), a share of them holding up **glowing phone screens** that read at
  night; the pit sways idly and **jumps with the music** while the show plays.
- **Crowd hype (the game loop)** — a live **hype meter** rises with well-timed,
  synced moments (lasers + FX on a loud drop) and dips on blackouts / dead air.
  The crowd reacts to it (bigger jumps, brighter phones), and when the show
  finishes you get a **star rating** — turning "programming a show" into a game
  with a score.
- **Procedural sound** — FX have voices (CO2 hiss, flame woomph, confetti
  flutter) and the **crowd roars when the hype spikes** on a drop. All
  synthesised in Web Audio (no asset files); toggle it with the Sound button.
- **Object library** — 28 object types across Stage / Lights / FX / Festival,
  one click to add to the scene, including **vertical structures** (truss
  towers, arches), **crowd barriers** and a **front-of-house mix tower**.
- **Festival grounds** — a whole decor category to build a believable site:
  **trees and bushes** with lumpy vertex-displaced foliage in muted natural
  greens (position-seeded, so copies never look cloned), a **7 m bar tent** with
  a plank counter, bottle shelves, warm service light and a printed BAR banner,
  a market-style **food stall**, a canvas **tent**, **toilet blocks** (lockable
  cabin + open urinal bay, occupancy dot), cloth **flags that ripple in the
  wind** and galvanised **perimeter fence panels** that chain with the magnet.
- **Realistic gear** — fixtures are modelled to read like real touring hardware:
  moving heads with a base, U-yoke and a tilting lit head; beam fixtures; LED
  strobe panels; 2×2 blinder lamp arrays; a laser projector with heat-sink fins
  and an aperture window; box-truss lattices (horizontal beams, vertical towers
  and goalpost arches); flown PA line-arrays with **perforated grills**; a stage
  deck with an **anti-slip plywood texture**; Mojo-style **crowd barriers**; a
  scaffold **FOH tower** with a glowing console; and dedicated FX machine bodies
  (hazer, flame canister, cryo bottle, confetti blower).
- **Power tools** — Shift-click to multi-select; then align to the anchor,
  distribute evenly, duplicate, **array** (N copies along an offset) and
  **mirror** the selection across the stage centre. Move the whole selection
  with the gizmo. `Ctrl/Cmd+D` duplicates.
- **Fixture groups** — save any multi-selection as a named **group** (in the
  Scene panel), then re-select every member in one click — no more picking
  lights one by one. Add an action with a group selected and it targets exactly
  those fixtures, and an action's **“Applies to”** picker has a one-click chip per
  group to add / remove all its fixtures at once.
- **Action transitions** — toggle **Transition** on a light / laser clip and it
  **crossfades** into the next block on its lane instead of snapping: colour,
  brightness and beam movement all interpolate (e.g. an up-sweep glides into a
  down-sweep). A clip with no follower **fades its lights out** gently. The fade
  time is adjustable.
- **Rigging** — clip a light / laser onto a truss (drop it straight onto the
  structure, or pick a parent in the inspector); moving the structure carries
  its rigged fixtures with it.
- **Volumetric lights** — a real SpotLight + additive beam cone,
  color/intensity/beam-angle/target, movement animation and a global strobe flash.
- **Lasers** — animated additive beam fans / drawn chains, per-fixture color.
- **FX** — GPU-light particle smoke, flame, CO2 and confetti bursts.
- **LED screen** — custom shader wall that changes color, pulses and reacts to
  the music level.
- **Inspector** — edit name, position, rotation, scale, color, intensity, beam
  angle and target; duplicate / delete.
- **Timeline** — Lights / Lasers / FX / LED tracks, real audio waveform (or a
  faux pattern for the demo), second ruler, draggable event clips, scrub
  playhead, per-track “add event”, full event editor (track/type/target/time/
  duration/params).
- **Timeline power-editing** — Shift-click to multi-select clips, drag one to
  move the group, copy/paste at the playhead (`Ctrl/Cmd+C`/`V`), horizontal
  **zoom** (with a Fit button) for longer shows, and one-click **templates**
  (strobe build-up, laser hit, CO2 drop, blackout + flash).
- **Audio** — import a local file, play / pause / stop / seek, analyser-driven
  reactivity, clean teardown. The track is **kept in IndexedDB per project**, so
  a saved show plays back with its audio after a reload — no re-importing.
- **Projects** — New (with confirm), Save / Load via `localStorage`, Export /
  Import JSON, defensive sanitisation of loaded files.
- **Shortcuts** — `Space` play/pause, `Delete`/`Backspace` remove selection,
  `Ctrl/Cmd+D` duplicate, `Ctrl/Cmd+C`/`V` copy / paste clips, `Ctrl/Cmd+Z`
  undo / redo, `W`/`E` move / rotate.

---

## Current limitations

- Particle FX and beams are stylised, not physically accurate.
- The audio waveform is sampled at load (no live re-decode); very long files
  take a moment to analyse.
- Audio blobs live in IndexedDB (per browser); they are not embedded in the
  exported JSON, so a shared export still needs its track re-imported.
- Single large JS bundle (Three.js) — no code-splitting tuning yet.

## Roadmap

Already shipped: real in-viewport transform gizmos (move/rotate, `W`/`E`),
undo/redo with a coalesced history, Build/Show modes, magnetic + grid snapping,
object multi-select with align / distribute / array / mirror, truss rigging,
per-project audio persistence, full timeline power-editing (event multi-select,
group move, copy/paste, horizontal zoom and quick templates), and a concrete
ground with a controllable day/night sky.

**Short term**

- Editor: drag-and-drop from the library into the viewport, a scale gizmo and
  Alt-drag duplicate.
- Timeline: musical markers (intro / build / drop / break / outro).

**Medium term**

- Bundle export (project + audio) as a single shareable file.
- Performance: lazy-load the 3D layer, particle pooling and a dedicated perf mode.

**Long term**

- More fixtures (gobos, pixel bars), beam textures and a reflective floor.
- Optional backend for cloud project storage and audio hosting.
