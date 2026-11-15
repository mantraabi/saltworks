# SALTWORKS

A tactical first-person shooter in three.js: 3v3 elimination with a device to plant, five rounds of
economy, and a map built like a refinery yard at dusk. No assets, no build step, no dependencies —
`game/` is static files the browser loads as ES modules, and three.js is the vendored copy the kit
shipped.

```
node serve.ts                      # http://localhost:8080
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Playing

| input | does |
| --- | --- |
| `W A S D` | move |
| mouse | aim (click the canvas to lock the pointer) |
| `left mouse` | fire — automatic on the rifle and the SMG, one shot per click on the pistol |
| `R` | reload |
| `Shift` | walk quietly |
| `C` / `Ctrl` | crouch |
| `Space` | jump |
| `E` | hold to plant the device on a site, hold to defuse it |
| `B` | armory, during the freeze or the buy window |
| `1`–`4` | buy the highlighted item while the armory is open |
| `G` | throw the grenade |
| `Tab` | scoreboard |
| `M` | mute |

You are TIDE, attacking. Carry the device into site A (the leaching floor) or site B (the brine
hall), hold `E` on the site to plant, then keep WARDEN off it for forty seconds. Rounds end on
elimination, on the device detonating, or on the clock. First side to seven rounds wins the match.

## The map

SALTWORKS is two sites, three lanes and two links, carved out of one solid mass so every wall is
closed and every doorway is a real gap:

```
        +---------+   +---------+   +---------+
        |  SITE A |   | CT SPAWN|   |  SITE B |
        +----+----+   +----+----+   +----+----+
             |             |             |
        +----+----+   +----+----+   +----+----+
        |  LONG   |---|   MID   |---| TUNNEL  |
        +----+----+   +----+----+   +----+----+
             |             |             |
             +------+  +---+---+  +------+
                    |  |T SPAWN|  |
                    +--+-------+--+
```

`game/src/world/mapdata.js` holds the rooms, doorways, props, routes and sites as data;
`game/src/world/world.js` carves the grid, merges the leftover solid cells into boxes, hands the
simulation one flat collider list, and builds the decoration (lamps, pipe runs, lintels, beams).

## How it is built

```
game/src/core/      palette, seeded rng, maths helpers
game/src/world/     map data, generated materials, the level builder
game/src/sim/       state store, collision, weapons, bodies, bots, rounds, the fixed-step simulation
game/src/render/    scene, actors, effects, first-person weapon
game/src/ui/        HUD and armory
game/src/audio/     synthesised sound (no audio files)
game/src/shotmode.js  the capture rig used for screenshots/
main.ts             the entrypoint: caps, copy, dossier
tools/              the headless capture driver (development only)
```

The simulation is fixed-step at 100 Hz and owns the whole match in one state object. The renderer only
reads it. Every random draw comes from one seeded generator, so the same seed fights the same fight
twice — which is what makes the screenshots reproducible.

## Screenshots

`shots.json` lists each capture with the query that reproduces it. A `?shot=<mode>` page runs the
real simulation to a chosen moment and then sets `window.__shotReady`; `tools/capture.mjs` drives a
headless Chromium over the DevTools protocol and writes the JPEG. Nothing is drawn by hand and no
frame is edited.

```
node serve.ts --port 8099 &
node tools/capture.mjs
```

## Licence

MIT, see `LICENSE`. three.js is MIT, vendored under `game/vendor/three/`.
