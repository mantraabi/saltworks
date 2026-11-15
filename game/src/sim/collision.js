// Actor collision against the level's boxes: axis-separated sweeps with a step-up allowance, so a
// player walks up the catwalk stairs without a jump and cannot walk through a wall. Every moving
// body in the game — the player and every bot — goes through these three functions.
import { clamp } from '../core/mathx.js';

export const STEP_HEIGHT = 0.42;
export const GRAVITY = 20.5;

const overlapsXZ = (actor, box, radius) =>
  actor.x + radius > box.x1 && actor.x - radius < box.x2 && actor.z + radius > box.z1 && actor.z - radius < box.z2;

// A box blocks a body only when it is tall enough to matter: a body standing at y can step over
// anything shorter than its step height, and cannot reach past a box that starts above its head.
const blocksBody = (box, y, height) => box.y1 > y + STEP_HEIGHT && box.y0 < y + height - 0.05;

// Move along one axis and clamp against the boxes that stand in the way.
export function moveAxis(actor, axis, delta, colliders, radius, height) {
  if (delta === 0) return false;
  actor[axis] += delta;
  let hit = false;
  for (let i = 0; i < colliders.length; i += 1) {
    const box = colliders[i];
    if (box.tag === 'platform' || box.tag === 'step') {
      if (!blocksBody(box, actor.y, height)) continue;
    } else if (!blocksBody(box, actor.y, height)) continue;
    if (!overlapsXZ(actor, box, radius)) continue;
    if (axis === 'x') {
      actor.x = delta > 0 ? box.x1 - radius : box.x2 + radius;
    } else {
      actor.z = delta > 0 ? box.z1 - radius : box.z2 + radius;
    }
    hit = true;
  }
  return hit;
}

// The highest surface directly under a body, so it can stand on a crate or a catwalk deck.
export function groundHeight(actor, colliders, radius) {
  let best = 0;
  const feet = actor.y;
  for (let i = 0; i < colliders.length; i += 1) {
    const box = colliders[i];
    if (!overlapsXZ(actor, box, radius * 0.9)) continue;
    if (box.y1 > feet + 0.02) continue;
    if (box.y1 > best) best = box.y1;
  }
  return best;
}

// Integrate one body for dt: horizontal wish velocity, then gravity, then the ground it landed on.
export function integrateBody(body, wishX, wishZ, dt, colliders) {
  const radius = body.radius ?? 0.34;
  const height = body.height ?? 1.78;

  moveAxis(body, 'x', wishX * dt, colliders, radius, height);
  moveAxis(body, 'z', wishZ * dt, colliders, radius, height);

  body.vy -= GRAVITY * dt;
  const nextY = body.y + body.vy * dt;
  const floor = groundHeight({ x: body.x, y: Math.max(body.y, nextY), z: body.z }, colliders, radius);
  if (nextY <= floor) {
    body.y = floor;
    body.vy = 0;
    body.onGround = true;
  } else {
    body.y = nextY;
    body.onGround = false;
  }
  body.y = clamp(body.y, 0, 8);
}

// Line of sight and bullet paths: the nearest box a ray meets, or null when the path is clear.
// Boxes are grown by `pad` so a shot down the edge of a wall does not squeeze through the seam.
export function raycastBoxes(colliders, ox, oy, oz, dx, dy, dz, maxDist, pad = 0.02) {
  let best = null;
  let bestDist = maxDist;
  for (let i = 0; i < colliders.length; i += 1) {
    const box = colliders[i];
    const cx = (box.x1 + box.x2) / 2;
    const cz = (box.z1 + box.z2) / 2;
    const hx = (box.x2 - box.x1) / 2 + pad;
    const hz = (box.z2 - box.z1) / 2 + pad;
    const cy = (box.y0 + box.y1) / 2;
    const hy = (box.y1 - box.y0) / 2 + pad;
    const t = rayAabbLocal(ox, oy, oz, dx, dy, dz, cx, cy, cz, hx, hy, hz, bestDist);
    if (t >= 0 && t < bestDist) {
      bestDist = t;
      best = { collider: box, dist: t };
    }
  }
  return best;
}

// The same slab test as mathx.rayAabb, kept local so this module owns the whole collision surface.
function rayAabbLocal(ox, oy, oz, dx, dy, dz, cx, cy, cz, hx, hy, hz, maxDist) {
  let tmin = 0;
  let tmax = maxDist;
  const o = [ox - cx, oy - cy, oz - cz];
  const d = [dx, dy, dz];
  const h = [hx, hy, hz];
  for (let i = 0; i < 3; i += 1) {
    if (Math.abs(d[i]) < 1e-8) {
      if (o[i] < -h[i] || o[i] > h[i]) return -1;
      continue;
    }
    const inv = 1 / d[i];
    let t1 = (-h[i] - o[i]) * inv;
    let t2 = (h[i] - o[i]) * inv;
    if (t1 > t2) {
      const swap = t1;
      t1 = t2;
      t2 = swap;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  return tmin;
}

// Clear line between an eye and a point: the bots' sight test.
export function hasLineOfSight(colliders, ox, oy, oz, tx, ty, tz) {
  const dx = tx - ox;
  const dy = ty - oy;
  const dz = tz - oz;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-4) return true;
  const hit = raycastBoxes(colliders, ox, oy, oz, dx / dist, dy / dist, dz / dist, dist);
  return hit === null;
}
