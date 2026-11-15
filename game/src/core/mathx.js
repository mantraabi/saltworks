// Small numeric helpers shared by the simulation. Pure functions, no allocation in the hot path:
// the vector helpers write into a caller-owned target so the loop makes no garbage per frame.
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const signOf = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

// Frame-rate independent approach: the fraction of the remaining gap to close in `dt` at `rate`.
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

export const DEG = Math.PI / 180;

// Wrap an angle into (-PI, PI], so yaw arithmetic never drifts by whole turns.
export function wrapAngle(a) {
  const turn = Math.PI * 2;
  let x = a % turn;
  if (x <= -Math.PI) x += turn;
  if (x > Math.PI) x -= turn;
  return x;
}

// The shortest signed rotation from a to b.
export const angleDelta = (a, b) => wrapAngle(b - a);

export function setVec3(target, x, y, z) {
  target.x = x;
  target.y = y;
  target.z = z;
  return target;
}

// Ray against an axis-aligned box given as centre and half extents. Returns the entry distance
// along a unit direction, or -1 when the ray misses. Used for hitscan and for line of sight.
export function rayAabb(ox, oy, oz, dx, dy, dz, cx, cy, cz, hx, hy, hz, maxDist) {
  let tmin = 0;
  let tmax = maxDist;
  const axes = [
    [ox - cx, dx, hx],
    [oy - cy, dy, hy],
    [oz - cz, dz, hz],
  ];
  for (let i = 0; i < 3; i += 1) {
    const [o, d, h] = axes[i];
    if (Math.abs(d) < 1e-8) {
      if (o < -h || o > h) return -1;
    } else {
      const inv = 1 / d;
      let t1 = (-h - o) * inv;
      let t2 = (h - o) * inv;
      if (t1 > t2) {
        const swap = t1;
        t1 = t2;
        t2 = swap;
      }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

// Ray against a sphere, clipped to maxDist. Returns distance or -1.
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r, maxDist) {
  const lx = ox - cx;
  const ly = oy - cy;
  const lz = oz - cz;
  const b = lx * dx + ly * dy + lz * dz;
  const c = lx * lx + ly * ly + lz * lz - r * r;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const sq = Math.sqrt(disc);
  const t0 = -b - sq;
  const t1 = -b + sq;
  if (t0 >= 0 && t0 <= maxDist) return t0;
  if (t1 >= 0 && t1 <= maxDist) return t1;
  return -1;
}

// Distance from a point to a segment on the ground plane; bots use it to read footstep noise.
export function distToSegment(px, pz, ax, az, bx, bz) {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const len2 = vx * vx + vz * vz;
  const t = len2 > 1e-8 ? clamp((wx * vx + wz * vz) / len2, 0, 1) : 0;
  const cx = ax + vx * t;
  const cz = az + vz * t;
  const dx = px - cx;
  const dz = pz - cz;
  return Math.sqrt(dx * dx + dz * dz);
}
