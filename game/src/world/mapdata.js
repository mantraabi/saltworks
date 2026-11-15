// SALTWORKS — the map, as data. A dead salt refinery: two sites, three lanes and two links.
// The level is a solid mass with rooms carved out of it, so every wall is closed and every
// doorway is exactly as wide as the data says. Nothing here touches three.js: this is the level
// description the world builder and the bots both read.
//
// Plan (north is -Z, the Warden side; south is +Z, the Tide side):
//
//        x -24      -15   -14        -6   6        14  15      24
//   z -19  +---------+------------+--------------+------------+---------+
//          | A SITE  |  WARDEN SPAWN             |  B SITE              |
//   z -14  +----+----+------+-----+------+------+----+------+----------+
//          |    |           |          |            |           |
//   z -13  | LONG LANE      |  MID LANE           | TUNNEL LANE         |
//          |    +-- LINK WEST (z -2..2) --+        +-- LINK EAST (4..8) |
//          |    |           |          |            |           |
//   z  13  |    |           |          |            |           |
//   z  14  +----+-----------+----------+------------+-----------+-------+
//          |                     TIDE SPAWN                            |
//   z  19  +----------------------------------------------------------+
//
// Each room is carved out of the solid mass; a DOOR is a one-metre-deep opening through the band
// that separates two rooms, so a doorway is a place the map makes, not a gap a builder forgets.

export const WORLD = { minX: -24, maxX: 24, minZ: -21, maxZ: 21, wallHeight: 4.6 };

// The rooms, carved open. x1 < x2, z1 < z2, all on whole metres so the grid stays clean.
export const ROOMS = [
  { id: 'a-site', zone: 'site-a', name: 'Site A · Leaching Floor', x1: -22, z1: -19, x2: -15, z2: -14 },
  { id: 'b-site', zone: 'site-b', name: 'Site B · Brine Hall', x1: 15, z1: -19, x2: 22, z2: -14 },
  { id: 'warden', zone: 'spawn-warden', name: 'Warden Spawn', x1: -14, z1: -19, x2: 14, z2: -14 },
  { id: 'long', zone: 'lane-long', name: 'Long Lane', x1: -22, z1: -13, x2: -15, z2: 19 },
  { id: 'mid', zone: 'lane-mid', name: 'Mid Lane', x1: -6, z1: -13, x2: 6, z2: 13 },
  { id: 'tunnel', zone: 'lane-tunnel', name: 'Tunnel Lane', x1: 15, z1: -13, x2: 22, z2: 19 },
  { id: 'tide', zone: 'spawn-tide', name: 'Tide Spawn', x1: -14, z1: 14, x2: 14, z2: 19 },
  { id: 'link-west', zone: 'link', name: 'Link West', x1: -14, z1: -2, x2: -7, z2: 2 },
  { id: 'link-east', zone: 'link', name: 'Link East', x1: 7, z1: 4, x2: 14, z2: 8 },
];

// Doorways: the opening punched through the band between two rooms. Two metres wide, one deep.
export const DOORS = [
  { id: 'a-site-long', x1: -20, z1: -14, x2: -18, z2: -13 },
  { id: 'b-site-tunnel', x1: 18, z1: -14, x2: 20, z2: -13 },
  { id: 'warden-a', x1: -15, z1: -18, x2: -14, z2: -16 },
  { id: 'warden-b', x1: 14, z1: -18, x2: 15, z2: -16 },
  { id: 'warden-mid', x1: -1, z1: -14, x2: 1, z2: -13 },
  { id: 'tide-mid', x1: -1, z1: 13, x2: 1, z2: 14 },
  { id: 'tide-long', x1: -15, z1: 16, x2: -14, z2: 18 },
  { id: 'tide-tunnel', x1: 14, z1: 16, x2: 15, z2: 18 },
  { id: 'long-link', x1: -15, z1: -1, x2: -14, z2: 1 },
  { id: 'link-mid-w', x1: -7, z1: -1, x2: -6, z2: 1 },
  { id: 'mid-link-e', x1: 6, z1: 5, x2: 7, z2: 7 },
  { id: 'link-tunnel', x1: 14, z1: 5, x2: 15, z2: 7 },
];

// The two devices sites: the centre a Tide player plants on, and the radius that counts as on-site.
export const SITES = [
  { id: 'a', name: 'A', label: 'Leaching Floor', x: -18.5, z: -16.5, radius: 2.6 },
  { id: 'b', name: 'B', label: 'Brine Hall', x: 18.5, z: -16.5, radius: 2.6 },
];

// Where each team starts. Index picks a slot; a capture asks for a named slot.
export const SPAWNS = {
  tide: [
    { x: -6.5, z: 16.5, yaw: Math.PI },
    { x: -2.5, z: 17.5, yaw: Math.PI },
    { x: 2.5, z: 17.5, yaw: Math.PI },
    { x: 6.5, z: 16.5, yaw: Math.PI },
    { x: 0, z: 15.6, yaw: Math.PI },
  ],
  warden: [
    { x: -6.5, z: -16.5, yaw: 0 },
    { x: -2.5, z: -17.5, yaw: 0 },
    { x: 2.5, z: -17.5, yaw: 0 },
    { x: 6.5, z: -16.5, yaw: 0 },
    { x: 0, z: -15.6, yaw: 0 },
  ],
};

// Props: solid cover you can shoot over, stand on, or hide behind. Kinds pick a look and a height.
export const PROPS = [
  // Long lane: container stacks and a sightline break halfway down.
  { kind: 'container', x: -20.5, z: 12.5, w: 3, d: 2.2, h: 2.6, yaw: 0 },
  { kind: 'container', x: -17.0, z: 8.0, w: 2.4, d: 3.2, h: 2.6, yaw: 0 },
  { kind: 'crate', x: -19.6, z: 4.5, w: 1.2, d: 1.2, h: 1.2, yaw: 0.24 },
  { kind: 'crate', x: -19.6, z: 4.5, w: 1.0, d: 1.0, h: 1.0, y: 1.2, yaw: -0.5 },
  { kind: 'crate', x: -16.6, z: 0.5, w: 1.3, d: 1.3, h: 1.3, yaw: 0.1 },
  { kind: 'tank', x: -20.4, z: -5.0, w: 2.2, d: 2.2, h: 3.4 },
  { kind: 'barrier', x: -18.4, z: -9.5, w: 3.2, d: 0.6, h: 1.05 },
  // Site A: a raised leaching tank to hold from, crates around the plant spot.
  { kind: 'tank', x: -21.0, z: -17.5, w: 2.4, d: 2.4, h: 3.2 },
  { kind: 'crate', x: -16.4, z: -18.0, w: 1.4, d: 1.4, h: 1.4, yaw: 0.3 },
  { kind: 'crate', x: -20.2, z: -15.2, w: 1.2, d: 1.2, h: 1.2, yaw: -0.2 },
  { kind: 'barrier', x: -18.2, z: -14.6, w: 3.0, d: 0.6, h: 1.05 },
  // Mid: the pump house splits the lane into two halves you can cross between.
  { kind: 'block', x: 0, z: 0, w: 3.2, d: 4.6, h: 3.0 },
  { kind: 'crate', x: -3.6, z: 2.6, w: 1.2, d: 1.2, h: 1.2, yaw: 0.4 },
  { kind: 'crate', x: 3.6, z: -2.6, w: 1.2, d: 1.2, h: 1.2, yaw: -0.35 },
  { kind: 'barrier', x: -2.6, z: 8.0, w: 2.6, d: 0.6, h: 1.05 },
  { kind: 'barrier', x: 2.6, z: -8.0, w: 2.6, d: 0.6, h: 1.05 },
  // Tunnel lane: a low catwalk over the crates, and a barrel choke near the site.
  { kind: 'container', x: 20.4, z: 11.5, w: 3.0, d: 2.2, h: 2.6 },
  { kind: 'crate', x: 17.2, z: 6.5, w: 1.2, d: 1.2, h: 1.2, yaw: 0.2 },
  { kind: 'crate', x: 17.2, z: 6.5, w: 1.0, d: 1.0, h: 1.0, y: 1.2, yaw: 0.8 },
  { kind: 'tank', x: 20.2, z: 1.0, w: 2.0, d: 2.0, h: 3.2 },
  { kind: 'barrier', x: 18.2, z: -6.0, w: 3.0, d: 0.6, h: 1.05 },
  // Site B: the brine hall, with a ring of cover around the plant spot.
  { kind: 'tank', x: 21.0, z: -17.6, w: 2.4, d: 2.4, h: 3.2 },
  { kind: 'crate', x: 16.4, z: -18.0, w: 1.4, d: 1.4, h: 1.4, yaw: -0.3 },
  { kind: 'crate', x: 20.2, z: -15.2, w: 1.2, d: 1.2, h: 1.2, yaw: 0.2 },
  { kind: 'barrier', x: 18.2, z: -14.6, w: 3.0, d: 0.6, h: 1.05 },
  // Spawns: a little cover so a spawn is not a shooting gallery.
  { kind: 'crate', x: -9.5, z: 16.5, w: 1.6, d: 1.6, h: 1.6 },
  { kind: 'crate', x: 9.5, z: 16.5, w: 1.6, d: 1.6, h: 1.6 },
  { kind: 'crate', x: -9.5, z: -16.5, w: 1.6, d: 1.6, h: 1.6 },
  { kind: 'crate', x: 9.5, z: -16.5, w: 1.6, d: 1.6, h: 1.6 },
];

// A raised walkway over mid, reached by ramps: the high ground that makes the lane worth holding.
export const CATWALKS = [
  { x1: -6, z1: 4.6, x2: -1.8, z2: 7.4, y: 1.5, ramp: { x1: -6, z1: 7.4, x2: -4.2, z2: 11.6, axis: 'z', dir: 1 } },
  { x1: 1.8, z1: -7.4, x2: 6, z2: -4.6, y: 1.5, ramp: { x1: 4.2, z1: -11.6, x2: 6, z2: -7.4, axis: 'z', dir: -1 } },
];

// Bot routes: named lanes as ordered waypoints. A handler picks a route and the bots walk it,
// stopping at the first waypoint whose ground they can see down. Every lane ends on a site.
export const ROUTES = {
  tide: {
    long: [
      { x: -16.5, z: 15.0, hold: 0 },
      { x: -18.5, z: 9.0, hold: 0 },
      { x: -18.5, z: 2.0, hold: 1.2 },
      { x: -18.5, z: -6.0, hold: 1.0 },
      { x: -18.5, z: -12.0, hold: 0 },
      { x: -19.0, z: -16.5, hold: 1.6 },
    ],
    mid: [
      { x: 0, z: 12.0, hold: 0 },
      { x: -3.2, z: 6.0, hold: 0.8 },
      { x: -3.4, z: 0, hold: 0 },
      { x: -3.4, z: -6.0, hold: 1.0 },
      { x: -1.0, z: -12.4, hold: 0 },
      { x: -12.0, z: -16.0, hold: 0 },
      { x: -18.5, z: -16.5, hold: 1.8 },
    ],
    tunnel: [
      { x: 17.5, z: 15.0, hold: 0 },
      { x: 18.5, z: 9.0, hold: 0 },
      { x: 18.5, z: 2.0, hold: 1.0 },
      { x: 18.5, z: -6.0, hold: 0.8 },
      { x: 18.5, z: -12.0, hold: 0 },
      { x: 18.5, z: -16.5, hold: 1.6 },
    ],
    link: [
      { x: 0, z: 12.0, hold: 0 },
      { x: -3.4, z: 6.0, hold: 0 },
      { x: -6.0, z: 0, hold: 0 },
      { x: -12.0, z: 0, hold: 0.6 },
      { x: -16.5, z: -1.0, hold: 0 },
      { x: -18.0, z: -8.0, hold: 0 },
      { x: -18.5, z: -16.5, hold: 1.4 },
    ],
  },
  warden: {
    long: [
      { x: -16.5, z: -13.6, hold: 0 },
      { x: -18.5, z: -9.0, hold: 0 },
      { x: -18.0, z: -3.0, hold: 1.4 },
      { x: -18.5, z: 4.0, hold: 1.2 },
      { x: -17.0, z: 10.0, hold: 1.0 },
    ],
    mid: [
      { x: 0, z: -13.6, hold: 0 },
      { x: 2.2, z: -8.0, hold: 0.8 },
      { x: 3.4, z: 0, hold: 0 },
      { x: 3.4, z: 6.0, hold: 1.0 },
      { x: 0.5, z: 11.0, hold: 1.2 },
    ],
    tunnel: [
      { x: 17.5, z: -13.6, hold: 0 },
      { x: 18.5, z: -8.0, hold: 0 },
      { x: 18.0, z: -1.0, hold: 1.2 },
      { x: 18.5, z: 6.0, hold: 1.0 },
      { x: 17.0, z: 11.0, hold: 1.0 },
    ],
    link: [
      { x: 0, z: -13.6, hold: 0 },
      { x: 3.4, z: -8.0, hold: 0 },
      { x: 6.0, z: 4.0, hold: 0 },
      { x: 12.0, z: 6.0, hold: 0.8 },
      { x: 17.0, z: 0, hold: 0 },
      { x: 18.0, z: 8.0, hold: 1.2 },
    ],
  },
};

// Floor zones carry their own paint, so the two sites read at a glance from anywhere.
export const ZONE_PAINT = {
  'site-a': { x: -18.5, z: -16.5, r: 3.4, ring: true },
  'site-b': { x: 18.5, z: -16.5, r: 3.4, ring: true },
  'spawn-tide': { x: 0, z: 16.5, r: 4.0, ring: false },
  'spawn-warden': { x: 0, z: -16.5, r: 4.0, ring: false },
};
