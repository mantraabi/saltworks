// Bot brains. Three behaviours are enough for a tactical round: walk your lane, hold the angle you
// were told to hold, and fight what you can see. Everything runs off the same bodies and weapons the
// player uses, and every random choice comes from the match generator, so a seeded round replays.
import { clamp, angleDelta, distToSegment } from '../core/mathx.js';
import { WEAPONS, canFire, fireShot, startReload, currentSpread } from './weapons.js';
import { hasLineOfSight } from './collision.js';
import { turnToward } from './player.js';
import { ROUTES, SITES } from '../world/mapdata.js';
import { siteAt } from './state.js';

const EYE = 1.58;

// A bot's aim error, in radians: a worse shot holds a wider cone and takes longer to settle.
function aimError(bot) {
  const skill = bot.ai.skill;
  const settle = clamp(bot.ai.timeOnTarget / 0.9, 0, 1);
  const base = (1 - skill) * 0.055 + 0.004;
  return base * (1.25 - settle * 0.85);
}

// Perception: which enemy this bot can see, and where it last saw one. Runs a few times a second,
// not every frame — deciding less often is both cheaper and more human.
function perceive(match, bot, colliders, rng) {
  let best = null;
  let bestScore = Infinity;
  for (const other of match.players) {
    if (!other.alive || other.side === bot.side) continue;
    const dx = other.x - bot.x;
    const dz = other.z - bot.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 52) continue;
    const eyeY = bot.y + EYE;
    const chestY = other.y + (other.crouching ? 0.85 : 1.2);
    const inFront = Math.abs(angleDelta(bot.yaw, Math.atan2(dx, -dz))) < 1.5;
    if (!hasLineOfSight(colliders, bot.x, eyeY, bot.z, other.x, chestY, other.z)) continue;
    // An enemy behind the bot is noticed late, which is what makes a flank worth walking.
    const score = dist * (inFront ? 1 : 2.4);
    if (score < bestScore) {
      bestScore = score;
      best = other;
    }
  }
  const ai = bot.ai;
  if (best) {
    if (ai.targetId !== best.id) ai.timeOnTarget = 0;
    ai.targetId = best.id;
    ai.canSee = true;
    ai.lastSeenX = best.x;
    ai.lastSeenZ = best.z;
    ai.lastSeenY = best.y;
    ai.reactAt = match.time + (0.16 + (1 - ai.skill) * 0.26);
  } else {
    ai.canSee = false;
    ai.targetId = null;
    ai.timeOnTarget = 0;
  }
  return best;
}

// Route following: advance through the lane's waypoints, stop at a hold point to watch an angle.
function steerRoute(match, bot, colliders) {
  const ai = bot.ai;
  const route = ROUTES[bot.side]?.[ai.route] ?? ROUTES[bot.side].mid;
  if (ai.routeIndex >= route.length) {
    ai.state = 'hold';
    return null;
  }
  const point = route[ai.routeIndex];
  const dx = point.x - bot.x;
  const dz = point.z - bot.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1.1) {
    ai.routeIndex += 1;
    if (point.hold > 0) {
      ai.holdUntil = match.time + point.hold;
      ai.state = 'hold';
    }
    return null;
  }
  const turn = Math.atan2(dx, -dz);
  turnToward(bot, turn, 0, match.dt, 7);
  return { x: dx / dist, z: dz / dist };
}

// The firing solution: aim at the chest of a visible enemy, add the skill's wobble, fire in bursts.
function engage(match, bot, target, colliders, rng, emit) {
  const ai = bot.ai;
  const def = WEAPONS[bot.weapon.id];
  const dx = target.x - bot.x;
  const dz = target.z - bot.z;
  const dist = Math.hypot(dx, dz);
  const aimY = target.y + (target.crouching ? 0.72 : 1.16);
  const err = aimError(bot) * (1 + dist / 40);
  const yaw = Math.atan2(dx, -dz) + rng.jitter(err);
  const pitch = Math.atan2(aimY - (bot.y + EYE), Math.max(dist, 0.4)) + rng.jitter(err * 0.6);
  turnToward(bot, yaw, pitch, match.dt, 9 + ai.skill * 9);
  ai.timeOnTarget += match.dt;

  const aligned = Math.abs(angleDelta(bot.yaw, Math.atan2(dx, -dz))) < 0.045 + err * 0.5;
  if (match.time < ai.reactAt || !aligned) return;

  if (bot.weapon.ammo <= 0) {
    startReload(bot, match.time);
    return;
  }

  // Burst discipline: hold the trigger for a few rounds, then let the cone close again.
  if (ai.burstPause > 0) {
    ai.burstPause -= match.dt;
    return;
  }
  if (canFire(bot, match.time)) {
    const spread = currentSpread(bot) + err * 0.55;
    const shot = fireShot(match, bot, colliders, rng, { spread });
    emit({ type: 'shot', playerId: bot.id, shot });
    ai.burst += 1;
    const burstLength = def.kind === 'pistol' ? 2 : def.kind === 'smg' ? 9 : 6;
    if (ai.burst >= burstLength) {
      ai.burst = 0;
      ai.burstPause = 0.14 + (1 - ai.skill) * 0.22;
    }
  }
  // Shuffle sideways between bursts so a duel is not two statues trading shots.
  if (match.time > ai.strafeUntil && bot.onGround) {
    ai.strafeDir = rng.sign();
    ai.strafeUntil = match.time + rng.range(0.5, 1.1);
  }
}

// The job on the objective: carry it, plant it, or pull it apart.
function objective(match, bot, colliders) {
  const ai = bot.ai;
  const bomb = match.bomb;
  if (bot.side === 'tide') {
    if (bomb.state === 'carried' && bomb.carrierId === bot.id) {
      const site = siteAt(bot.x, bot.z);
      if (site) {
        ai.state = 'plant';
        bot.crouching = true;
        return { site };
      }
    }
    return null;
  }
  if (bomb.state === 'planted') {
    ai.state = 'defuse';
    const dx = bomb.x - bot.x;
    const dz = bomb.z - bot.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 1.1) {
      turnToward(bot, Math.atan2(dx, -dz), 0, match.dt, 8);
      return { x: dx / dist, z: dz / dist };
    }
    bot.crouching = true;
    return { atBomb: true };
  }
  return null;
}

// One fixed step for one bot: perceive, decide, aim, shoot, walk.
export function updateBot(match, bot, colliders, rng, emit) {
  if (!bot.alive) return;
  const ai = bot.ai;
  if (match.time >= ai.thinkAt) {
    perceive(match, bot, colliders, rng);
    ai.thinkAt = match.time + 0.1;
    if (ai.canSee) ai.state = 'engage';
    else if (ai.state === 'engage') ai.state = 'advance';
  }

  const target = ai.targetId ? match.players.find((p) => p.id === ai.targetId && p.alive) : null;
  let wish = null;

  const objMove = objective(match, bot, colliders);
  if (objMove && (objMove.x !== undefined || objMove.atBomb || objMove.site)) {
    if (objMove.x !== undefined) wish = { x: objMove.x, z: objMove.z };
    else wish = null;
  } else if (target && ai.canSee) {
    engage(match, bot, target, colliders, rng, emit);
    wish = { x: Math.cos(bot.yaw) * ai.strafeDir, z: Math.sin(bot.yaw) * ai.strafeDir };
  } else if (ai.state === 'hold' && match.time < (ai.holdUntil ?? 0)) {
    // Watch the last thing it knew about, weapon ready.
    turnToward(bot, Math.atan2(ai.lastSeenX - bot.x, -(ai.lastSeenZ - bot.z)), 0, match.dt, 4);
    wish = null;
  } else {
    wish = steerRoute(match, bot, colliders);
    if (!wish && ai.state === 'hold') {
      turnToward(bot, Math.atan2(ai.heardX - bot.x, -(ai.heardZ - bot.z)), 0, match.dt, 3);
    }
  }

  // Nudge around a wall the bot has been walking into.
  const moved = Math.hypot(bot.x - ai.lastX, bot.z - ai.lastZ);
  if (wish && moved < 0.012 && match.dt > 0) {
    ai.stuckFor += match.dt;
    if (ai.stuckFor > 0.45) {
      const side = ai.strafeDir;
      wish = { x: Math.cos(bot.yaw) * side, z: Math.sin(bot.yaw) * side };
      if (ai.stuckFor > 1.3) {
        ai.stuckFor = 0;
        ai.stuckForReset = true;
        ai.routeIndex += 1;
      }
    }
  } else {
    ai.stuckFor = 0;
  }
  ai.lastX = bot.x;
  ai.lastZ = bot.z;

  bot.wishX = wish ? wish.x : 0;
  bot.wishZ = wish ? wish.z : 0;
  if (bot.ai.state === 'plant') {
    bot.wishX = 0;
    bot.wishZ = 0;
  }

  if (bot.weapon.ammo === 0 && !bot.weapon.reloading && bot.weapon.reserve > 0) startReload(bot, match.time);
}

// A loud noise — a shot, a plant, a footstep on steel — turns every nearby head.
export function notifyNoise(match, x, z, radius, exceptId) {
  for (const bot of match.players) {
    if (!bot.ai || !bot.alive || bot.id === exceptId) continue;
    const dist = Math.hypot(bot.x - x, bot.z - z);
    if (dist > radius) continue;
    bot.ai.heardX = x;
    bot.ai.heardZ = z;
    if (!bot.ai.canSee) {
      bot.ai.lastSeenX = x;
      bot.ai.lastSeenZ = z;
      bot.ai.state = 'hold';
      bot.ai.holdUntil = match.time + 1.1;
    }
  }
}

// Which site a bot should head for, chosen by its lane so the two sites get attacked unevenly.
export function siteForRoute(route) {
  return route === 'tunnel' ? SITES[1] : SITES[0];
}

// Distance from a bot to the nearest point of a route's next waypoint — used by the spawn logic to
// spread a team across lanes instead of stacking them.
export function laneDistance(bot, route) {
  const points = ROUTES[bot.side]?.[route];
  if (!points) return Infinity;
  let best = Infinity;
  for (let i = 1; i < points.length; i += 1) {
    best = Math.min(best, distToSegment(bot.x, bot.z, points[i - 1].x, points[i - 1].z, points[i].x, points[i].z));
  }
  return best;
}
