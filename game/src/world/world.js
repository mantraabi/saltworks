// The world builder: carves the rooms out of a solid mass, merges the leftovers into as few boxes
// as possible, and hands the simulation a flat list of axis-aligned colliders. The renderer and the
// simulation read the same boxes, so what you see is exactly what stops a bullet.
import * as THREE from 'three';
import { PALETTE } from '../core/palette.js';
import { WORLD, ROOMS, DOORS, PROPS, CATWALKS, SITES, ZONE_PAINT } from './mapdata.js';
import { buildMaterials, PROP_STYLE } from './materials.js';

const CELL = 0.5;

// Is a cell centre inside this rectangle?
const inside = (rect, x, z) => x >= rect.x1 && x <= rect.x2 && z >= rect.z1 && z <= rect.z2;

// Mark every grid cell the level leaves open: the rooms, plus the doorways punched between them.
function carveGrid() {
  const cols = Math.round((WORLD.maxX - WORLD.minX) / CELL);
  const rows = Math.round((WORLD.maxZ - WORLD.minZ) / CELL);
  const open = new Uint8Array(cols * rows);
  const zones = new Array(cols * rows).fill(null);
  const centreX = (c) => WORLD.minX + (c + 0.5) * CELL;
  const centreZ = (r) => WORLD.minZ + (r + 0.5) * CELL;

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = centreX(c);
      const z = centreZ(r);
      for (const room of ROOMS) {
        if (inside(room, x, z)) {
          open[r * cols + c] = 1;
          zones[r * cols + c] = room.zone;
          break;
        }
      }
    }
  }
  for (const door of DOORS) {
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (open[r * cols + c]) continue;
        if (!inside(door, centreX(c), centreZ(r))) continue;
        open[r * cols + c] = 1;
        zones[r * cols + c] = 'door';
      }
    }
  }
  return { cols, rows, open, zones };
}

// Greedy rectangle merge over the solid cells: row runs first, then grow each run downward while
// the row below has the identical run. A whole refinery wing becomes one box.
function mergeSolid(grid) {
  const { cols, rows, open } = grid;
  const taken = new Uint8Array(cols * rows);
  const rects = [];
  for (let r = 0; r < rows; r += 1) {
    let c = 0;
    while (c < cols) {
      if (open[r * cols + c] || taken[r * cols + c]) {
        c += 1;
        continue;
      }
      let end = c;
      while (end + 1 < cols && !open[r * cols + end + 1] && !taken[r * cols + end + 1]) end += 1;
      let depth = 1;
      grow: while (r + depth < rows) {
        for (let cc = c; cc <= end; cc += 1) {
          if (open[(r + depth) * cols + cc] || taken[(r + depth) * cols + cc]) break grow;
        }
        depth += 1;
      }
      for (let rr = r; rr < r + depth; rr += 1) {
        for (let cc = c; cc <= end; cc += 1) taken[rr * cols + cc] = 1;
      }
      rects.push({
        x1: WORLD.minX + c * CELL,
        z1: WORLD.minZ + r * CELL,
        x2: WORLD.minX + (end + 1) * CELL,
        z2: WORLD.minZ + (r + depth) * CELL,
      });
      c = end + 1;
    }
  }
  return rects;
}

// A flat letter for the site floor markings, drawn once on a canvas.
function letterMaterial(letter, colour) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = colour;
  ctx.font = 'bold 104px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 64, 70);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.55, depthWrite: false });
}

// Detail pass: the things that are not cover and have no collision — lamps with their warm pools of
// light, pipe runs along the walls, steel lintels over the doorways, beams across the lanes and the
// hazard posts that mark a site entrance. None of it changes how the map plays; all of it changes how
// the map reads.
function decorate(group, mats) {
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffe0b4,
    emissive: 0xffb347,
    emissiveIntensity: 2.4,
    roughness: 0.35,
  });
  const housingMat = new THREE.MeshStandardMaterial({ color: PALETTE.gunmetal, roughness: 0.55, metalness: 0.7 });
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x6a5c4c, roughness: 0.7, metalness: 0.35 });
  const hazardMat = new THREE.MeshStandardMaterial({ color: PALETTE.amber, roughness: 0.68 });

  // Lamps hung from the wall tops, each with a real point light so the lane pools warm at night.
  const lampSpots = [
    [0.6, 6.2],
    [-0.4, -6.2],
    [-18.5, 3.0],
    [-18.5, -7.4],
    [18.5, 3.0],
    [18.5, -7.4],
    [-18.4, -16.6],
    [18.4, -16.6],
  ];
  for (const [x, z] of lampSpots) {
    const housing = new THREE.Mesh(unit, housingMat);
    housing.scale.set(0.5, 0.16, 0.5);
    housing.position.set(x, WORLD.wallHeight - 0.24, z);
    group.add(housing);

    const bulb = new THREE.Mesh(unit, lampMat);
    bulb.scale.set(0.34, 0.07, 0.34);
    bulb.position.set(x, WORLD.wallHeight - 0.34, z);
    group.add(bulb);

    const light = new THREE.PointLight(0xffb877, 7, 15, 2);
    light.position.set(x, WORLD.wallHeight - 0.6, z);
    group.add(light);
  }

  // Pipe runs: three lines down the long wall, a pair across the top of the tunnels.
  const pipeGeo = new THREE.CylinderGeometry(0.11, 0.11, 1, 8);
  const pipeRun = (x, y, z1, z2) => {
    const pipe = new THREE.Mesh(pipeGeo, pipeMat);
    pipe.scale.set(1, z2 - z1, 1);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(x, y, (z1 + z2) / 2);
    group.add(pipe);
  };
  pipeRun(-21.55, 2.75, -17, 18);
  pipeRun(-21.55, 3.05, -17, 18);
  pipeRun(21.55, 2.75, -17, 18);
  pipeRun(21.55, 3.05, -17, 18);

  // Lintels: a steel beam over every doorway, so a gap in a wall reads as a way through.
  for (const door of DOORS) {
    const w = door.x2 - door.x1;
    const d = door.z2 - door.z1;
    const beam = new THREE.Mesh(unit, mats.steel);
    if (w > d) {
      beam.scale.set(w + 0.8, 0.34, 0.46);
    } else {
      beam.scale.set(0.46, 0.34, d + 0.8);
    }
    beam.position.set((door.x1 + door.x2) / 2, 2.62, (door.z1 + door.z2) / 2);
    group.add(beam);
  }

  // Beams across the lanes: a roof structure that breaks the skyline and catches the low sun.
  const beamMat = new THREE.MeshStandardMaterial({ color: PALETTE.shadow, roughness: 0.72, metalness: 0.3 });
  const lanes = [
    { x: 0, z1: -13, z2: 13, span: 12 },
    { x: -18.5, z1: -13, z2: 19, span: 7 },
    { x: 18.5, z1: -13, z2: 19, span: 7 },
  ];
  for (const lane of lanes) {
    for (let z = lane.z1 + 2; z < lane.z2; z += 5.5) {
      const beam = new THREE.Mesh(unit, beamMat);
      beam.scale.set(lane.span, 0.26, 0.3);
      beam.position.set(lane.x, WORLD.wallHeight + 0.2, z);
      group.add(beam);
    }
  }

  // Hazard posts either side of each site entrance.
  for (const site of SITES) {
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(unit, hazardMat);
      post.scale.set(0.16, 0.9, 0.16);
      post.position.set(site.x + side * 2.9, 0.45, site.z + 3.1);
      group.add(post);
    }
  }
}

// Build the level. Returns the group to add to the scene, the collider list the simulation walks
// against, and a few named anchors the rest of the game needs.
export function buildWorld() {
  const mats = buildMaterials();
  const grid = carveGrid();
  const group = new THREE.Group();
  group.name = 'saltworks';
  const colliders = [];

  // ---- floor, paint, sky-facing ground plane
  const floorGeo = new THREE.PlaneGeometry(WORLD.maxX - WORLD.minX, WORLD.maxZ - WORLD.minZ, 1, 1);
  const floor = new THREE.Mesh(floorGeo, mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((WORLD.minX + WORLD.maxX) / 2, 0, (WORLD.minZ + WORLD.maxZ) / 2);
  floor.receiveShadow = true;
  group.add(floor);

  for (const [zone, paint] of Object.entries(ZONE_PAINT)) {
    const mat = zone === 'site-a' ? mats.paintA : zone === 'site-b' ? mats.paintB : mats.paintNeutral;
    const ring = new THREE.Mesh(new THREE.RingGeometry(paint.r - 0.16, paint.r, 48), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(paint.x, 0.02, paint.z);
    group.add(ring);
  }
  for (const site of SITES) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(site.radius, 32), site.id === 'a' ? mats.paintA : mats.paintB);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(site.x, 0.012, site.z);
    disc.material = disc.material.clone();
    disc.material.opacity = 0.1;
    group.add(disc);
    const letter = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 2.4),
      letterMaterial(site.name, site.id === 'a' ? '#ffb347' : '#8fb4cc'),
    );
    letter.rotation.x = -Math.PI / 2;
    letter.position.set(site.x, 0.03, site.z);
    group.add(letter);
  }

  // ---- the solid mass, merged
  const wallRects = mergeSolid(grid);
  const wallGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const rect of wallRects) {
    const w = rect.x2 - rect.x1;
    const d = rect.z2 - rect.z1;
    const h = WORLD.wallHeight;
    const mesh = new THREE.Mesh(wallGeo, mats.wall);
    mesh.scale.set(w, h, d);
    mesh.position.set(rect.x1 + w / 2, h / 2, rect.z1 + d / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push({ x1: rect.x1, z1: rect.z1, x2: rect.x2, z2: rect.z2, y0: 0, y1: h, tag: 'wall' });

    // A steel cap along the top edge reads as a roofline and breaks up the flat concrete.
    const cap = new THREE.Mesh(wallGeo, mats.steel);
    cap.scale.set(w + 0.16, 0.22, d + 0.16);
    cap.position.set(rect.x1 + w / 2, h + 0.1, rect.z1 + d / 2);
    group.add(cap);
  }

  // ---- props: cover with a body and a painted band
  const propGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const prop of PROPS) {
    const yaw = prop.yaw ?? 0;
    const baseY = prop.y ?? 0;
    const style = PROP_STYLE[prop.kind] ?? PROP_STYLE.block;
    const body = new THREE.Mesh(propGeo, mats[style.body]);
    body.scale.set(prop.w, prop.h, prop.d);
    body.position.set(prop.x, baseY + prop.h / 2, prop.z);
    body.rotation.y = yaw;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const bandHeight = Math.max(0.1, prop.h * style.accentBand);
    const band = new THREE.Mesh(propGeo, mats[style.accent]);
    band.scale.set(prop.w + 0.05, bandHeight, prop.d + 0.05);
    band.position.set(prop.x, baseY + prop.h - bandHeight / 2, prop.z);
    band.rotation.y = yaw;
    group.add(band);

    // Collision uses the axis-aligned bounds of the turned box, so a turned crate still stops you.
    const cos = Math.abs(Math.cos(yaw));
    const sin = Math.abs(Math.sin(yaw));
    const halfW = (prop.w * cos + prop.d * sin) / 2;
    const halfD = (prop.w * sin + prop.d * cos) / 2;
    colliders.push({
      x1: prop.x - halfW,
      z1: prop.z - halfD,
      x2: prop.x + halfW,
      z2: prop.z + halfD,
      y0: baseY,
      y1: baseY + prop.h,
      tag: 'prop',
    });
  }

  // ---- catwalks: a platform on legs with a stair you can climb, not a ramp you can slip off
  for (const walk of CATWALKS) {
    const w = walk.x2 - walk.x1;
    const d = walk.z2 - walk.z1;
    const deck = new THREE.Mesh(propGeo, mats.steel);
    deck.scale.set(w, 0.2, d);
    deck.position.set((walk.x1 + walk.x2) / 2, walk.y - 0.1, (walk.z1 + walk.z2) / 2);
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);
    colliders.push({ x1: walk.x1, z1: walk.z1, x2: walk.x2, z2: walk.z2, y0: walk.y - 0.2, y1: walk.y, tag: 'platform' });

    const edge = new THREE.Mesh(propGeo, mats.hazard);
    edge.scale.set(w, 0.1, d);
    edge.position.set((walk.x1 + walk.x2) / 2, walk.y + 0.01, (walk.z1 + walk.z2) / 2);
    group.add(edge);

    // Legs at the four corners.
    for (const [lx, lz] of [
      [walk.x1 + 0.25, walk.z1 + 0.25],
      [walk.x2 - 0.25, walk.z1 + 0.25],
      [walk.x1 + 0.25, walk.z2 - 0.25],
      [walk.x2 - 0.25, walk.z2 - 0.25],
    ]) {
      const leg = new THREE.Mesh(propGeo, mats.steel);
      leg.scale.set(0.18, walk.y, 0.18);
      leg.position.set(lx, walk.y / 2, lz);
      group.add(leg);
    }

    // Stairs: three steps of half a metre, each its own collider so the walk-up is physical.
    const steps = 3;
    const rise = walk.y / steps;
    const run = (walk.ramp.z2 - walk.ramp.z1) / steps;
    for (let i = 0; i < steps; i += 1) {
      const stepTop = rise * (i + 1);
      const z1 = walk.ramp.dir > 0 ? walk.ramp.z1 + run * i : walk.ramp.z2 - run * (i + 1);
      const z2 = z1 + run;
      const box = new THREE.Mesh(propGeo, mats.wall);
      box.scale.set(walk.ramp.x2 - walk.ramp.x1, stepTop, run);
      box.position.set((walk.ramp.x1 + walk.ramp.x2) / 2, stepTop / 2, z1 + run / 2);
      box.castShadow = true;
      box.receiveShadow = true;
      group.add(box);
      colliders.push({
        x1: walk.ramp.x1,
        z1,
        x2: walk.ramp.x2,
        z2,
        y0: 0,
        y1: stepTop,
        tag: 'step',
      });
    }
  }

  // ---- skyline: a few silhouettes past the walls so the edge of the map is not a void
  const stackMat = new THREE.MeshStandardMaterial({ color: PALETTE.shadow, roughness: 0.95 });
  const skyline = [
    { x: -30, z: -26, w: 4, h: 13, d: 4 },
    { x: 30, z: -24, w: 5, h: 9, d: 5 },
    { x: -34, z: 8, w: 6, h: 16, d: 3 },
    { x: 33, z: 14, w: 4, h: 11, d: 4 },
    { x: 0, z: -34, w: 9, h: 7, d: 4 },
  ];
  for (const block of skyline) {
    const mesh = new THREE.Mesh(propGeo, stackMat);
    mesh.scale.set(block.w, block.h, block.d);
    mesh.position.set(block.x, block.h / 2, block.z);
    group.add(mesh);
  }

  // ---- detail pass: everything that is decoration rather than cover
  decorate(group, mats);

  const spawnY = { tide: 0, warden: 0 };
  return { group, colliders, mats, spawnY };
}
