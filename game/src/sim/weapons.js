// Weapons and ballistics. One table describes every gun; one trace resolves every shot. The player
// and the bots fire through the same function, so a bot's bullet obeys the same spread, the same
// falloff and the same hitboxes as yours.
import { rayAabb, raySphere, clamp } from '../core/mathx.js';
import { raycastBoxes } from './collision.js';

export const WEAPONS = {
  marlow: {
    id: 'marlow',
    name: 'MARLOW M4',
    slot: 1,
    kind: 'rifle',
    price: 2700,
    auto: true,
    rpm: 640,
    damage: 33,
    headMul: 4.0,
    legMul: 0.72,
    magazine: 30,
    reserve: 90,
    reloadTime: 2.25,
    range: 90,
    falloffStart: 24,
    falloffEnd: 0.55,
    spreadBase: 0.0032,
    spreadMove: 0.052,
    spreadAir: 0.14,
    spreadCrouch: 0.62,
    recoilPitch: 0.0165,
    recoilYaw: 0.0062,
    recoilRecover: 8.2,
    drawTime: 0.5,
  },
  vesper: {
    id: 'vesper',
    name: 'VESPER 9',
    slot: 1,
    kind: 'smg',
    price: 1250,
    auto: true,
    rpm: 880,
    damage: 23,
    headMul: 3.2,
    legMul: 0.8,
    magazine: 25,
    reserve: 100,
    reloadTime: 1.85,
    range: 60,
    falloffStart: 15,
    falloffEnd: 0.45,
    spreadBase: 0.0045,
    spreadMove: 0.03,
    spreadAir: 0.1,
    spreadCrouch: 0.7,
    recoilPitch: 0.0105,
    recoilYaw: 0.0075,
    recoilRecover: 9.5,
    drawTime: 0.4,
  },
  sidewinder: {
    id: 'sidewinder',
    name: 'SIDEWINDER .45',
    slot: 2,
    kind: 'pistol',
    price: 0,
    auto: false,
    rpm: 400,
    damage: 29,
    headMul: 3.4,
    legMul: 0.78,
    magazine: 12,
    reserve: 48,
    reloadTime: 1.6,
    range: 55,
    falloffStart: 18,
    falloffEnd: 0.6,
    spreadBase: 0.0038,
    spreadMove: 0.026,
    spreadAir: 0.09,
    spreadCrouch: 0.72,
    recoilPitch: 0.0205,
    recoilYaw: 0.0045,
    recoilRecover: 10.5,
    drawTime: 0.32,
  },
  cutlass: {
    id: 'cutlass',
    name: 'CUTLASS',
    slot: 3,
    kind: 'knife',
    price: 0,
    auto: false,
    rpm: 130,
    damage: 42,
    headMul: 1.6,
    legMul: 0.7,
    magazine: Infinity,
    reserve: 0,
    reloadTime: 0,
    range: 2.1,
    falloffStart: 2.1,
    falloffEnd: 1,
    spreadBase: 0,
    spreadMove: 0,
    spreadAir: 0,
    spreadCrouch: 1,
    recoilPitch: 0,
    recoilYaw: 0,
    recoilRecover: 12,
    drawTime: 0.28,
    melee: true,
  },
};

export const UTILITY = {
  he: { id: 'he', name: 'HE CHARGE', slot: 4, price: 300, radius: 4.6, damage: 96, fuse: 1.9 },
  kevlar: { id: 'kevlar', name: 'PLATE CARRIER', slot: 5, price: 620, armor: 100 },
};

export const HITBOX = {
  head: { offsetY: 1.60, radius: 0.17 },
  torso: { half: 0.26, y0: 0.98, y1: 1.48 },
  legs: { half: 0.24, y0: 0.0, y1: 0.98 },
};

// A fresh, empty weapon state for a body that just bought or spawned with a gun.
export function makeWeaponState(id) {
  const def = WEAPONS[id];
  return {
    id,
    ammo: def.magazine,
    reserve: def.reserve,
    reloading: false,
    reloadEnds: 0,
    nextFireAt: 0,
    equipped: true,
  };
}

// The cone a shot leaves the barrel in: base spread, plus what movement, air and stance add.
export function currentSpread(player) {
  const def = WEAPONS[player.weapon.id];
  if (def.melee) return 0;
  const speed = Math.hypot(player.vx, player.vz);
  const moving = clamp(speed / 5.2, 0, 1) * def.spreadMove;
  const air = player.onGround ? 0 : def.spreadAir;
  const stance = player.crouching ? def.spreadCrouch : 1;
  const burst = clamp(player.recoil.pitch * 6, 0, 1) * def.spreadBase * 1.8;
  return (def.spreadBase + moving + air + burst) * stance;
}

// Can this body pull the trigger right now?
export function canFire(player, now) {
  const def = WEAPONS[player.weapon.id];
  if (!player.alive) return false;
  if (player.weapon.reloading) return false;
  if (now < player.weapon.nextFireAt) return false;
  if (def.melee) return true;
  return player.weapon.ammo > 0;
}

export function startReload(player, now) {
  const def = WEAPONS[player.weapon.id];
  if (def.melee || player.weapon.reloading) return false;
  if (player.weapon.ammo >= def.magazine) return false;
  if (player.weapon.reserve <= 0) return false;
  player.weapon.reloading = true;
  player.weapon.reloadEnds = now + def.reloadTime;
  player.weapon.reloadStartedAt = now;
  return true;
}

// Weapon timers: reload completion and the recoil settling back toward the aim point.
export function tickWeapon(player, dt, now) {
  const def = WEAPONS[player.weapon.id];
  if (player.weapon.reloading && now >= player.weapon.reloadEnds) {
    const needed = def.magazine - player.weapon.ammo;
    const taken = Math.min(needed, player.weapon.reserve);
    player.weapon.ammo += taken;
    player.weapon.reserve -= taken;
    player.weapon.reloading = false;
  }
  const recover = player.recoil.recover ?? def.recoilRecover;
  const settle = 1 - Math.exp(-recover * dt);
  player.recoil.pitch -= player.recoil.pitch * settle;
  player.recoil.yaw -= player.recoil.yaw * settle;
  player.aimPunch -= player.aimPunch * (1 - Math.exp(-9 * dt));
}

// The nearest body a ray from the shooter meets, before it meets a wall.
function traceActors(match, shooter, ox, oy, oz, dx, dy, dz, maxDist) {
  let best = null;
  for (const target of match.players) {
    if (!target.alive || target.side === shooter.side || target.id === shooter.id) continue;
    const feet = target.y;
    const headY = feet + HITBOX.head.offsetY + (target.crouching ? -0.26 : 0);
    const headT = raySphere(ox, oy, oz, dx, dy, dz, target.x, headY, target.z, HITBOX.head.radius, maxDist);
    if (headT >= 0 && (best === null || headT < best.dist)) best = { target, dist: headT, zone: 'head' };
    const torsoY = (feet + (target.crouching ? 0.52 : 0.78)) + (HITBOX.torso.y1 - HITBOX.torso.y0) / 2;
    const torsoT = rayAabb(
      ox, oy, oz, dx, dy, dz,
      target.x, torsoY, target.z,
      HITBOX.torso.half, (HITBOX.torso.y1 - HITBOX.torso.y0) / 2, HITBOX.torso.half,
      maxDist,
    );
    if (torsoT >= 0 && (best === null || torsoT < best.dist)) best = { target, dist: torsoT, zone: 'torso' };
    const legHalfY = (target.crouching ? 0.52 : 0.49);
    const legY = feet + legHalfY;
    const legT = rayAabb(
      ox, oy, oz, dx, dy, dz,
      target.x, legY, target.z,
      HITBOX.legs.half, legHalfY, HITBOX.legs.half,
      maxDist,
    );
    if (legT >= 0 && (best === null || legT < best.dist)) best = { target, dist: legT, zone: 'legs' };
  }
  return best;
}

// Resolve one shot: the cone picks a direction, the nearest of wall and body takes it.
export function fireShot(match, player, colliders, rng, opts = {}) {
  const def = WEAPONS[player.weapon.id];
  const spread = opts.spread ?? currentSpread(player);
  const yaw = player.yaw + player.recoil.yaw + rng.jitter(spread);
  const pitch = player.pitch + player.recoil.pitch + rng.jitter(spread * (def.melee ? 0 : 1));
  const cp = Math.cos(pitch);
  const dx = Math.sin(yaw) * cp;
  const dy = Math.sin(pitch);
  const dz = -Math.cos(yaw) * cp;

  const eyeY = player.y + (player.crouching ? 1.18 : 1.58) + player.aimPunch * 0.1;
  const ox = player.x - dx * 0.25;
  const oy = eyeY;
  const oz = player.z - dz * 0.25;

  if (!def.melee) {
    player.weapon.ammo -= 1;
    player.weapon.nextFireAt = match.time + 60 / def.rpm;
    player.recoil.pitch += def.recoilPitch * (player.crouching ? 0.72 : 1);
    player.recoil.yaw += rng.jitter(def.recoilYaw);
    player.shotsFired = (player.shotsFired ?? 0) + 1;
  } else {
    player.weapon.nextFireAt = match.time + 60 / def.rpm;
  }

  const wallHit = raycastBoxes(colliders, ox, oy, oz, dx, dy, dz, def.range);
  const wallDist = wallHit ? wallHit.dist : def.range;
  const actorHit = traceActors(match, player, ox, oy, oz, dx, dy, dz, Math.min(def.range, wallDist));

  const result = {
    weapon: def.id,
    fromX: ox,
    fromY: oy,
    fromZ: oz,
    toX: ox + dx * (actorHit ? actorHit.dist : wallDist),
    toY: oy + dy * (actorHit ? actorHit.dist : wallDist),
    toZ: oz + dz * (actorHit ? actorHit.dist : wallDist),
    hitWall: !actorHit && wallHit !== null,
    targetId: null,
    zone: null,
    damage: 0,
    killed: false,
  };

  if (actorHit) {
    const falloff =
      actorHit.dist <= def.falloffStart
        ? 1
        : clamp(1 - ((actorHit.dist - def.falloffStart) / (def.range - def.falloffStart)) * (1 - def.falloffEnd), def.falloffEnd, 1);
    const mul = actorHit.zone === 'head' ? def.headMul : actorHit.zone === 'legs' ? def.legMul : 1;
    const raw = def.damage * mul * falloff;
    const applied = applyDamage(actorHit.target, raw, player, actorHit.zone);
    result.targetId = actorHit.target.id;
    result.zone = actorHit.zone;
    result.damage = applied;
    result.killed = !actorHit.target.alive;
  }
  return result;
}

// Damage, with a plate carrier soaking part of it. Returns the health actually removed.
export function applyDamage(target, amount, attacker, zone) {
  if (!target.alive) return 0;
  let damage = amount;
  if (target.armor > 0) {
    const absorbed = damage * 0.46;
    const spend = Math.min(target.armor, absorbed * 0.85);
    target.armor = Math.max(0, target.armor - spend);
    damage -= absorbed;
  }
  target.health -= damage;
  target.lastHitBy = attacker ? attacker.id : null;
  target.lastHitZone = zone;
  target.flinch = Math.min(1, (target.flinch ?? 0) + 0.5);
  if (target.health <= 0) {
    target.health = 0;
    target.alive = false;
    target.diedAt = target.matchTime ?? 0;
    if (attacker) {
      attacker.kills = (attacker.kills ?? 0) + 1;
      if (zone === 'head') attacker.headshots = (attacker.headshots ?? 0) + 1;
    }
  }
  return damage;
}

// A thrown HE charge: a timed radial burst that falls off with distance and respects walls.
export function explode(match, colliders, grenade) {
  const hits = [];
  for (const target of match.players) {
    if (!target.alive) continue;
    const dx = target.x - grenade.x;
    const dy = target.y + 0.9 - grenade.y;
    const dz = target.z - grenade.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > UTILITY.he.radius) continue;
    const blocked = raycastBoxes(colliders, grenade.x, grenade.y + 0.2, grenade.z, dx / dist, dy / dist, dz / dist, dist);
    if (blocked) continue;
    const falloff = 1 - dist / UTILITY.he.radius;
    const owner = grenade.ownerId ? match.players.find((p) => p.id === grenade.ownerId) : null;
    const applied = applyDamage(target, UTILITY.he.damage * falloff * falloff, owner, 'blast');
    hits.push({ targetId: target.id, damage: applied });
  }
  return hits;
}
