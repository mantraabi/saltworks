// The simulation: builds the two teams, then advances the match in fixed steps. Rendering, sound and
// the HUD are all downstream of this file — nothing here knows a camera exists, which is why the same
// code runs headless for a capture frame.
import { createMatch, playerById, pushEvent, addKillfeed, PHASE, siteAt } from './state.js';
import { createPlayer, moveHuman, moveBot, equip } from './player.js';
import { updateBot, notifyNoise } from './bots.js';
import { canFire, fireShot, startReload, tickWeapon, WEAPONS, UTILITY, explode } from './weapons.js';
import { tickRounds, tickBomb, startRound } from './rounds.js';
import { createRng } from '../core/rng.js';
import { SPAWNS } from '../world/mapdata.js';
import { hasLineOfSight } from './collision.js';

const STEP = 1 / 100;
export { STEP };
const ROSTER = [
  { id: 'you', name: 'YOU', side: 'tide', isBot: false, weapon: 'sidewinder' },
  { id: 'rivet', name: 'RIVET', side: 'tide', isBot: true, route: 'long', weapon: 'sidewinder', skill: 0.52 },
  { id: 'moss', name: 'MOSS', side: 'tide', isBot: true, route: 'tunnel', weapon: 'sidewinder', skill: 0.46 },
  { id: 'harrow', name: 'HARROW', side: 'warden', isBot: true, route: 'long', weapon: 'sidewinder', skill: 0.62 },
  { id: 'kestrel', name: 'KESTREL', side: 'warden', isBot: true, route: 'mid', weapon: 'sidewinder', skill: 0.58 },
  { id: 'brant', name: 'BRANT', side: 'warden', isBot: true, route: 'tunnel', weapon: 'sidewinder', skill: 0.5 },
];

export function createSimulation({ colliders, seed = 1337 }) {
  const match = createMatch(seed);
  const rng = createRng(seed);
  const spawnIndex = { tide: 0, warden: 0 };

  for (const spec of ROSTER) {
    const slots = SPAWNS[spec.side];
    const slot = slots[spawnIndex[spec.side] % slots.length];
    spawnIndex[spec.side] += 1;
    const body = createPlayer({ ...spec, x: slot.x, z: slot.z, yaw: slot.yaw });
    match.players.push(body);
  }
  match.playerId = 'you';

  const effects = [];
  let accumulator = 0;
  let prevAlive = new Map();

  startRound(match, rng);
  for (const p of match.players) prevAlive.set(p.id, p.alive);

  const emit = (event) => {
    if (event.type === 'shot') {
      const sh = event.shot;
      effects.push({ kind: 'tracer', ...sh, born: match.time });
      if (sh.hitWall) effects.push({ kind: 'impact', x: sh.toX, y: sh.toY, z: sh.toZ, born: match.time });
      if (sh.targetId) effects.push({ kind: 'blood', x: sh.toX, y: sh.toY, z: sh.toZ, born: match.time });
      const shooter = playerById(match, event.playerId);
      if (shooter) {
        if (shooter.id === match.playerId) match.stats.shots += 1;
        if (sh.targetId) {
          if (shooter.id === match.playerId) match.stats.hits += 1;
          shooter.shotsHit = (shooter.shotsHit ?? 0) + 1;
        }
      }
      notifyNoise(match, sh.fromX, sh.fromZ, 34, event.playerId);
    } else {
      pushEvent(match, event);
    }
  };

  // Buy phase purchases — the same prices the bots pay, refused outside the freeze/live window.
  function buy(id) {
    const player = playerById(match, match.playerId);
    if (!player || !player.alive) return { ok: false, reason: 'down' };
    if (match.phase !== PHASE.freeze && match.phase !== PHASE.live) return { ok: false, reason: 'closed' };
    if (id === 'kevlar') {
      if (player.armor >= 100) return { ok: false, reason: 'owned' };
      if (player.money < UTILITY.kevlar.price) return { ok: false, reason: 'money' };
      player.money -= UTILITY.kevlar.price;
      player.armor = UTILITY.kevlar.armor;
      return { ok: true, label: UTILITY.kevlar.name };
    }
    if (id === 'he') {
      if (player.grenades > 0) return { ok: false, reason: 'owned' };
      if (player.money < UTILITY.he.price) return { ok: false, reason: 'money' };
      player.money -= UTILITY.he.price;
      player.grenades = 1;
      return { ok: true, label: UTILITY.he.name };
    }
    const def = WEAPONS[id];
    if (!def) return { ok: false, reason: 'unknown' };
    if (player.money < def.price) return { ok: false, reason: 'money' };
    player.money -= def.price;
    equip(player, id);
    player.keptWeapon = true;
    return { ok: true, label: def.name };
  }

  // One fixed step. `input` is what the human is holding down this frame.
  function step(input) {
    match.dt = STEP;
    match.tick += 1;
    match.time += STEP;
    const player = playerById(match, match.playerId);

    if (match.phase === PHASE.matchOver) {
      moveHuman(player, { ...input, forward: false, back: false, left: false, right: false }, STEP, colliders, match.time);
      return;
    }

    const frozen = match.phase === PHASE.freeze;
    const moveInput = frozen ? { ...input, forward: false, back: false, left: false, right: false, jump: false, fire: false } : input;
    moveHuman(player, moveInput, STEP, colliders, match.time);

    if (!frozen && player.alive) {
      if (input.reload) startReload(player, match.time);
      const wantsFire = WEAPONS[player.weapon.id].auto ? input.fire : input.fire && input.firePressed;
      if (wantsFire && canFire(player, match.time)) {
        emit({ type: 'shot', playerId: player.id, shot: fireShot(match, player, colliders, rng) });
      }
      if (input.grenade && player.grenades > 0) {
        player.grenades = 0;
        const dx = Math.sin(player.yaw) * Math.cos(player.pitch);
        const dz = -Math.cos(player.yaw) * Math.cos(player.pitch);
        match.grenades.push({
          x: player.x + dx * 0.5,
          y: player.y + 1.5,
          z: player.z + dz * 0.5,
          vx: dx * 13,
          vy: 4.2 + Math.sin(player.pitch) * 6,
          vz: dz * 13,
          fuse: UTILITY.he.fuse,
          ownerId: player.id,
        });
      }
    }

    for (const bot of match.players) {
      if (!bot.ai) continue;
      updateBot(match, bot, colliders, rng, emit);
      moveBot(bot, STEP, colliders, match.time);
    }

    // Grenades: arc under gravity, bounce off the level, then burst.
    for (let i = match.grenades.length - 1; i >= 0; i -= 1) {
      const g = match.grenades[i];
      g.vy -= 11.5 * STEP;
      const nx = g.x + g.vx * STEP;
      const nz = g.z + g.vz * STEP;
      if (hasLineOfSight(colliders, g.x, g.y, g.z, nx, g.y, nz)) {
        g.x = nx;
        g.z = nz;
      } else {
        g.vx *= -0.42;
        g.vz *= -0.42;
      }
      g.y += g.vy * STEP;
      if (g.y < 0.16) {
        g.y = 0.16;
        g.vy = Math.abs(g.vy) * 0.34;
        g.vx *= 0.72;
        g.vz *= 0.72;
      }
      g.fuse -= STEP;
      if (g.fuse <= 0) {
        const hits = explode(match, colliders, g);
        effects.push({ kind: 'blast', x: g.x, y: g.y, z: g.z, born: match.time });
        for (const h of hits) emit({ type: 'blast-hit', ...h });
        match.grenades.splice(i, 1);
      }
    }

    const useHeld = !frozen && input.use && player.alive;
    const planters = useHeld && match.bomb.carrierId === player.id ? [player] : [];
    const defusers = useHeld ? [player] : [];
    for (const bot of match.players) {
      if (!bot.ai || !bot.alive) continue;
      if (bot.ai.state === 'plant' && match.bomb.carrierId === bot.id) planters.push(bot);
      if (bot.ai.state === 'defuse' && Math.hypot(bot.x - match.bomb.x, bot.z - match.bomb.z) < 1.2) defusers.push(bot);
    }
    tickBomb(match, STEP, planters, defusers);
    tickRounds(match, STEP);

    // Deaths this step become killfeed lines and scoreboard deaths.
    for (const p of match.players) {
      const was = prevAlive.get(p.id);
      if (was && !p.alive) {
        p.deaths += 1;
        const killer = p.lastHitBy ? playerById(match, p.lastHitBy) : null;
        addKillfeed(match, {
          killerId: killer ? killer.id : null,
          killerName: killer ? killer.name : 'ENVIRONMENT',
          killerSide: killer ? killer.side : null,
          victimId: p.id,
          victimName: p.name,
          victimSide: p.side,
          weapon: killer ? killer.weapon.id : 'fall',
          zone: p.lastHitZone ?? 'torso',
        });
        if (killer && killer.id === match.playerId) match.stats.kills += 1;
        if (killer && killer.id === match.playerId && p.lastHitZone === 'head') match.stats.headshots += 1;
        if (killer) killer.money = Math.min(16000, killer.money + 300);
        emit({ type: 'death', victimId: p.id, killerId: killer ? killer.id : null });
      }
      prevAlive.set(p.id, p.alive);
    }

    // Effects have a short life so the renderer never accumulates geometry.
    for (let i = effects.length - 1; i >= 0; i -= 1) {
      if (match.time - effects[i].born > 1.6) effects.splice(i, 1);
    }
  }

  return {
    match,
    rng,
    colliders,
    effects,
    buy,
    step,
    get player() {
      return playerById(match, match.playerId);
    },
  };
}

// Run the simulation forward without rendering — used by the capture harness to reach a chosen
// moment, and by the determinism check.
export function advance(sim, seconds, input = {}) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) sim.step(input);
  return sim;
}
